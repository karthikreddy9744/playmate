package com.playmate.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.entity.Game;
import com.playmate.repository.GameRepository;
import com.playmate.service.MessageService;

@Component
public class CleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(CleanupScheduler.class);

    private final GameRepository gameRepository;
    private final MessageService messageService;

    public CleanupScheduler(GameRepository gameRepository, MessageService messageService) {
        this.gameRepository = gameRepository;
        this.messageService = messageService;
    }

    /**
     * Runs every 15 minutes.
     * Purges messages for games that ended more than 30 min ago.
     * The game entity itself is kept in the DB for admin analytics.
     */
    @Scheduled(fixedDelayString = "PT15M")
    @Transactional
    public void purgeMessagesAfterGameEnd() {
        LocalDateTime now = LocalDateTime.now();
        log.info("Cleanup scheduler started at {}", LocalDateTime.now());
        // Use all non-cancelled games so older games' messages are also cleaned up
        List<Game> games = gameRepository.findByIsCancelledFalse();
        for (Game g : games) {
            if (g.getGameDateTime() == null) continue;
            Integer dur = g.getDurationMinutes();
            LocalDateTime end = g.getGameDateTime().plusMinutes(dur != null ? dur : 60);
            if (now.isAfter(end.plusMinutes(30))) {
                messageService.purgeGameMessages(g.getId());
                log.info("Purged messages for completed game id={} (ended {})", g.getId(), end);
            }
        }
    }
}
