package com.playmate.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.entity.Game;
import com.playmate.entity.Notification;
import com.playmate.entity.User;
import com.playmate.repository.GameRepository;
import com.playmate.repository.RatingRepository;
import com.playmate.repository.UserRepository;
import com.playmate.service.MessageService;
import com.playmate.service.NotificationService;
import com.playmate.service.RatingService;

@Component
public class RatingScheduler {

    private static final Logger log = LoggerFactory.getLogger(RatingScheduler.class);

    private final GameRepository gameRepository;
    private final RatingRepository ratingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final RatingService ratingService;

    public RatingScheduler(GameRepository gameRepository, 
                           RatingRepository ratingRepository, 
                           UserRepository userRepository,
                           NotificationService notificationService,
                           MessageService messageService,
                           RatingService ratingService) {
        this.gameRepository = gameRepository;
        this.ratingRepository = ratingRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.ratingService = ratingService;
    }

    /**
     * Runs every 1 minute for precise timing of game completion and message deletion.
     */
    @Scheduled(fixedRate = 60000) // 1 minute
    @Transactional
    public void processGameLifecycle() {
        LocalDateTime now = LocalDateTime.now();
        
        // 0. Auto-reveal blind ratings older than 48 hours
        try {
            ratingService.autoRevealRatings();
        } catch (Exception e) {
            log.error("Failed to auto-reveal ratings: {}", e.getMessage());
        }

        // Fetch all active/recent games to process lifecycle
        // We look back up to 50 hours to cover the 48h rating window
        List<Game> activeGames = gameRepository.findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(now.minusHours(50));
        
        for (Game game : activeGames) {
            LocalDateTime startTime = game.getGameDateTime();
            LocalDateTime endTime = startTime.plusMinutes(game.getDurationMinutes() != null ? game.getDurationMinutes().longValue() : 60);
            
            // --- 1. FEEDBACK ENABLED + NOTIFICATION (T_end + 15 min) ---
            // More robust check: if 15 mins passed and game is still in OPEN status, purge and move to COMPLETED
            if (now.isAfter(endTime.plusMinutes(15)) && game.getStatus() == Game.GameStatus.OPEN) {
                // Mark as COMPLETED
                game.setStatus(Game.GameStatus.COMPLETED);
                gameRepository.save(game);
                incrementUserStats(game);
                
                // Absolute deletion as per user requirement
                this.messageService.purgeGameMessages(game.getId());
                
                // Send "Rate your game experience" notification
                sendRemindersToParticipants(game, "Rate your game experience", "How was the " + game.getSportType() + " game? Rate your playmates now!");
            }

            // --- 2. MESSAGES DELETED (T_end + 30 min) -> Move to ARCHIVED ---
            if (now.isAfter(endTime.plusMinutes(30)) && game.getStatus() == Game.GameStatus.COMPLETED) {
                // Mark as ARCHIVED to indicate lifecycle progressed
                game.setStatus(Game.GameStatus.ARCHIVED);
                gameRepository.save(game);
            }

            // --- 3. FEEDBACK POPUP SHOWN (T_end + 60 min) ---
            // (Frontend handles the actual popup, but we can send a notification as a trigger/reminder)
            if (now.isAfter(endTime.plusHours(1)) && now.isBefore(endTime.plusHours(1).plusMinutes(2))) {
                sendRemindersToParticipants(game, "Rating is now open!", "Please share your feedback about today's game.");
            }

            // --- 4. FINAL REMINDER (T_end + 24 hr) ---
            if (now.isAfter(endTime.plusHours(24)) && now.isBefore(endTime.plusHours(24).plusMinutes(2))) {
                sendRemindersToParticipants(game, "Final reminder: Rate your game", "Last chance to rate your playmates!");
            }

            // --- 5. FEEDBACK CLOSED (T_end + 48 hr) ---
            // (Handled by RatingService.submitRating blocking and frontend hiding)
        }

        // 6. Handle Message Deletion for Cancelled Games (Deletion + 10 min)
        List<Game> cancelledGames = gameRepository.findByIsCancelledTrueAndGameDateTimeAfterOrderByGameDateTimeAsc(now.minusHours(1));
        for (Game game : cancelledGames) {
            if (game.getCancelledAt() != null && now.isAfter(game.getCancelledAt().plusMinutes(10))) {
                // If not already archived, purge and archive
                if (game.getStatus() != Game.GameStatus.ARCHIVED) {
                    this.messageService.purgeGameMessages(game.getId());
                    game.setStatus(Game.GameStatus.ARCHIVED);
                    gameRepository.save(game);
                }
            }
        }
    }

    private void incrementUserStats(Game game) {
        // Increment for host
        userRepository.findById(game.getCreatedBy()).ifPresent(host -> {
            host.setTotalGamesPlayed(host.getTotalGamesPlayed() + 1);
            userRepository.save(host);
        });

        // Increment for all participants
        if (game.getParticipants() != null) {
            for (User participant : game.getParticipants()) {
                // Host is often in participants list too, but we should only increment once
                if (!participant.getId().equals(game.getCreatedBy())) {
                    participant.setTotalGamesPlayed(participant.getTotalGamesPlayed() + 1);
                    userRepository.save(participant);
                }
            }
        }
    }

    private void sendRemindersToParticipants(Game game, String title, String message) {
        // Block rating if participants <= 1
        if (game.getParticipants() == null || game.getParticipants().size() <= 1) return;
        
        for (User user : game.getParticipants()) {
            boolean alreadyRated = ratingRepository.existsByRaterIdAndGameId(user.getId(), game.getId());
            if (!alreadyRated) {
                notificationService.createNotification(
                        user.getId(),
                        Notification.NotificationType.RATING_REMINDER,
                        title,
                        message,
                        game.getId(),
                        "GAME"
                );
            }
        }
    }
}