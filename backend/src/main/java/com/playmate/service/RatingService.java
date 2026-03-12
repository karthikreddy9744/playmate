package com.playmate.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
        User rater = userRepository.findById(raterId)
                .orElseThrow(() -> new UserNotFoundException("Rater not found"));
        User ratee = userRepository.findById(request.getRateeId())
                .orElseThrow(() -> new UserNotFoundException("Ratee not found"));
        Game game = gameRepository.findById(request.getGameId())
                .orElseThrow(() -> new GameNotFoundException("Game not found"));

        Rating rating = new Rating();
        rating.setRater(rater);
        rating.setRatee(ratee);
        rating.setGame(game);
        rating.setPunctuality(request.getPunctuality());
        rating.setSkillMatch(request.getSkillMatch());
        rating.setFriendliness(request.getFriendliness());
        rating.setReviewText(request.getReviewText());

        // Auto-determine rating type based on who's rating whom
        if (raterId.equals(game.getCreatedBy())) {
            // Host is rating a participant → this is a "joining" rating for the participant
            rating.setRatingType(Rating.RatingType.FOR_PARTICIPANT);
        } else {
            // Participant is rating the host → this is a "hosting" rating for the host
            rating.setRatingType(Rating.RatingType.FOR_HOST);
        }

        Rating saved = ratingRepository.save(rating);

        // Update user's average rating
        updateUserAverageRating(ratee.getId());

        // Send notification
        notificationService.createNotification(
                ratee.getId(),
                Notification.NotificationType.RATING_RECEIVED,
                "New Rating Received",
                rater.getName() + " rated you after a " + game.getSportType() + " game",
                rating.getId(),
                "RATING"
        );

        return saved;
    }

    public List<Rating> getRatingsForUser(Long userId) {
        return ratingRepository.findByRateeId(userId);
    }

    /** Ratings where user was rated as a HOST (by participants) */
    public List<Rating> getHostRatingsForUser(Long userId) {
        return ratingRepository.findByRateeIdAndRatingType(userId, Rating.RatingType.FOR_HOST);
    }

    /** Ratings where user was rated as a PARTICIPANT/JOINER (by the host) */
    public List<Rating> getParticipantRatingsForUser(Long userId) {
        return ratingRepository.findByRateeIdAndRatingType(userId, Rating.RatingType.FOR_PARTICIPANT);
    }

    private void updateUserAverageRating(Long userId) {
        List<Rating> ratings = ratingRepository.findByRateeId(userId);
        if (ratings.isEmpty()) return;

        double totalScore = ratings.stream()
                .mapToDouble(r -> (r.getPunctuality() + r.getSkillMatch() + r.getFriendliness()) / 3.0)
                .average()
                .orElse(0.0);

        User user = userRepository.findById(userId).orElseThrow();
        user.setAverageRating(BigDecimal.valueOf(totalScore).setScale(2, RoundingMode.HALF_UP));
        userRepository.save(user);
    }
}
