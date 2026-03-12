package com.playmate.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.entity.Game;
import com.playmate.repository.GameRepository;
import com.playmate.service.MessageService;

@Component
@EnableScheduling
public class CleanupScheduler {

    private final GameRepository gameRepository;
    private final MessageService messageService;

    public CleanupScheduler(GameRepository gameRepository, MessageService messageService) {
        this.gameRepository = gameRepository;
        this.messageService = messageService;
    }

    // Runs every 15 minutes
    @Scheduled(fixedDelayString = "PT15M")
    @Transactional
    public void purgeOldChatsAfterGameEnd() {
        // Look at games from last 7 days to catch anything that recently ended
        List<Game> games = gameRepository.findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(LocalDateTime.now().minusDays(7));
        for (Game g : games) {
            if (g.getGameDateTime() == null) continue;
            Integer dur = g.getDurationMinutes();
            // Delete messages 30 min after game ends (startTime + duration + 30 min)
            LocalDateTime end = g.getGameDateTime().plusMinutes(dur != null ? dur : 60);
            if (LocalDateTime.now().isAfter(end.plusMinutes(30))) {
                messageService.purgeGameMessages(g.getId());
            }
        }
    }
}
