package com.playmate.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.dto.RatingRequest;
import com.playmate.entity.Game;
import com.playmate.entity.Notification;
import com.playmate.entity.Rating;
import com.playmate.entity.User;
import com.playmate.exception.GameNotFoundException;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.GameRepository;
import com.playmate.repository.RatingRepository;
import com.playmate.repository.UserRepository;

@Service
public class RatingService {

    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GameRepository gameRepository;

    @Autowired
    private NotificationService notificationService;

    @Transactional
    public Rating createRating(Long raterId, RatingRequest request) {
        return submitRating(raterId, request);
    }

    @Transactional
    public Rating submitRating(Long raterId, RatingRequest request) {
        User rater = userRepository.findById(raterId)
                .orElseThrow(() -> new UserNotFoundException("Rater not found"));
        User ratee = userRepository.findById(request.getRateeId())
                .orElseThrow(() -> new UserNotFoundException("Ratee not found"));
        Game game = gameRepository.findById(request.getGameId())
                .orElseThrow(() -> new GameNotFoundException("Game not found"));

        // CRITICAL RULES (MUST IMPLEMENT)
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startTime = game.getGameDateTime();
        if (startTime == null) {
            throw new IllegalStateException("Game start time is missing.");
        }
        LocalDateTime endTime = startTime.plusMinutes(Objects.requireNonNullElse(game.getDurationMinutes(), 60));

        // 1. Form exists ONLY for completed games (NOW >= T_end + 15 min)
        if (now.isBefore(endTime.plusMinutes(15))) {
            throw new RuntimeException("Feedback system becomes active 15 minutes after game ends.");
        }

        // 2. Form closed: T_end + 48 hours
        if (now.isAfter(endTime.plusHours(48))) {
            throw new RuntimeException("Feedback window has expired (48h limit).");
        }

        // 3. TRUST VERIFICATION: Allowed even for cancelled/deleted games
        // This helps track host performance and ghosting reports for admin dashboard.

        // 4. participants <= 1
        if (game.getParticipants() == null || game.getParticipants().size() <= 1) {
            throw new RuntimeException("No interaction -> no rating (requires >1 participant).");
        }

        // 6. user not in game
        boolean raterInGame = game.getParticipants().stream().anyMatch(u -> u.getId().equals(raterId));
        boolean rateeInGame = game.getParticipants().stream().anyMatch(u -> u.getId().equals(request.getRateeId()));
        if (!raterInGame || !rateeInGame) {
            throw new RuntimeException("User not part of this game.");
        }

        // Prevent duplicate rating
        if (ratingRepository.existsByRaterIdAndRateeIdAndGameId(
                raterId, request.getRateeId(), request.getGameId())) {
            throw new RuntimeException("Rating already submitted.");
        }

        Rating rating = new Rating();
        rating.setRater(rater);
        rating.setRatee(ratee);
        rating.setGame(game);
        rating.setPunctuality(request.getPunctuality());
        rating.setSkillMatch(request.getSkillMatch());
        rating.setFriendliness(request.getFriendliness());
        rating.setReviewText(request.getReviewText());
        rating.setPlayAgain(request.getPlayAgain());

        // BLIND RATING
        rating.setIsHidden(true);
        rating.setRevealedAt(null);

        // Auto-determine rating type based on who's rating whom
        if (raterId.equals(game.getCreatedBy())) {
            // Host is rating a participant → this is a "joining" rating for the participant
            rating.setRatingType(Rating.RatingType.FOR_PARTICIPANT);
            // Host cannot set wasGameConducted (only participants report if host showed up)
            rating.setWasGameConducted(null);
        } else {
            // Participant is rating the host → this is a "hosting" rating for the host
            rating.setRatingType(Rating.RatingType.FOR_HOST);
            rating.setWasGameConducted(request.getWasGameConducted());

            // LOGIC: If participant reports game NOT conducted, penalize host reliability
            if (Boolean.FALSE.equals(request.getWasGameConducted())) {
                updateHostReliabilityForGhosting(game.getCreatedBy());
            }
        }

        Rating saved = ratingRepository.save(rating);

        checkAndRevealRatings(request.getGameId(), raterId, request.getRateeId());

        updatePlayAgainScore(request.getRateeId());

        // Update user's average rating (only for revealed ratings)
        updateUserAverageRating(ratee.getId());

        // Send notification
        notificationService.createNotification(
                ratee.getId(),
                Notification.NotificationType.RATING_RECEIVED,
                "New Rating Received",
                rater.getName() + " rated you after a " + game.getSportType() + " game. It will be revealed once you rate them back or after 48 hours.",
                rating.getId(),
                "RATING"
        );

        return saved;
    }

    private void updateHostReliabilityForGhosting(Long hostId) {
        userRepository.findById(hostId).ifPresent(host -> {
            // A "Ghosting" report (game not conducted) is a major trust penalty
            // Reduce reliability by 5% per report
            host.setHostReliabilityScore(host.getHostReliabilityScore().subtract(new java.math.BigDecimal("5.00")));
            if (host.getHostReliabilityScore().compareTo(java.math.BigDecimal.ZERO) < 0) {
                host.setHostReliabilityScore(java.math.BigDecimal.ZERO);
            }
            userRepository.save(host);
        });
    }

    private void checkAndRevealRatings(Long gameId, Long userA, Long userB) {
        Optional<Rating> r1 = ratingRepository.findByRaterIdAndRateeIdAndGameId(userA, userB, gameId);
        Optional<Rating> r2 = ratingRepository.findByRaterIdAndRateeIdAndGameId(userB, userA, gameId);

        if (r1.isPresent() && r2.isPresent()) {
            Rating rating1 = r1.get();
            Rating rating2 = r2.get();

            rating1.setIsHidden(false);
            rating2.setIsHidden(false);

            rating1.setRevealedAt(LocalDateTime.now());
            rating2.setRevealedAt(LocalDateTime.now());

            ratingRepository.save(rating1);
            ratingRepository.save(rating2);
            
            // Re-calculate average ratings after revealing
            updateUserAverageRating(userA);
            updateUserAverageRating(userB);
        }
    }

    @Scheduled(fixedRate = 3600000) // every 1 hour
    public void autoRevealRatings() {
        List<Rating> hiddenRatings = ratingRepository.findByIsHiddenTrue();

        for (Rating rating : hiddenRatings) {
            Game game = gameRepository.findById(rating.getGame().getId()).orElse(null);
            if (game == null) continue;

            LocalDateTime gameEnd = game.getGameDateTime().plusMinutes(
                    game.getDurationMinutes() != null ? game.getDurationMinutes().longValue() : 60);

            if (LocalDateTime.now().isAfter(gameEnd.plusHours(48))) {
                rating.setIsHidden(false);
                rating.setRevealedAt(LocalDateTime.now());
                ratingRepository.save(rating);
                
                // Re-calculate average rating after revealing
                updateUserAverageRating(rating.getRatee().getId());
            }
        }
    }

    private void updatePlayAgainScore(Long userId) {
        List<Rating> ratings = ratingRepository.findByRateeId(userId);
        long total = ratings.size();
        long positive = ratings.stream()
                .filter(r -> Boolean.TRUE.equals(r.getPlayAgain()))
                .count();

        double percentage = (total == 0) ? 0 : (positive * 100.0 / total);

        User user = userRepository.findById(userId).orElseThrow();
        user.setPlayAgainPercentage(BigDecimal.valueOf(percentage).setScale(2, RoundingMode.HALF_UP));
        userRepository.save(user);
    }

    public List<Rating> getRatingsForUser(Long userId) {
        // Only return revealed ratings for general view, but maybe user can see their own?
        // Let's filter hidden ones
        return ratingRepository.findByRateeId(userId).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                .collect(java.util.stream.Collectors.toList());
    }

    /** Ratings where user was rated as a HOST (by participants) */
    public List<Rating> getHostRatingsForUser(Long userId) {
        return ratingRepository.findByRateeIdAndRatingType(userId, Rating.RatingType.FOR_HOST).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                .collect(java.util.stream.Collectors.toList());
    }

    /** Ratings where user was rated as a PARTICIPANT/JOINER (by the host) */
    public List<Rating> getParticipantRatingsForUser(Long userId) {
        return ratingRepository.findByRateeIdAndRatingType(userId, Rating.RatingType.FOR_PARTICIPANT).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                .collect(java.util.stream.Collectors.toList());
    }

    private void updateUserAverageRating(Long userId) {
        List<Rating> ratings = ratingRepository.findByRateeId(userId).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                .collect(java.util.stream.Collectors.toList());
        
        if (ratings.isEmpty()) {
            User user = userRepository.findById(userId).orElseThrow();
            user.setAverageRating(BigDecimal.ZERO);
            userRepository.save(user);
            return;
        }

        double totalScore = ratings.stream()
                .mapToDouble(r -> (r.getPunctuality() + r.getSkillMatch() + r.getFriendliness()) / 3.0)
                .average()
                .orElse(0.0);

        User user = userRepository.findById(userId).orElseThrow();
        user.setAverageRating(BigDecimal.valueOf(totalScore).setScale(2, RoundingMode.HALF_UP));
        userRepository.save(user);
    }
}
