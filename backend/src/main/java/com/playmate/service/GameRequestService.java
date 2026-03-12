package com.playmate.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.entity.Game;
import com.playmate.entity.GameRequest;
import com.playmate.entity.Notification;
import com.playmate.entity.User;
import com.playmate.repository.GameRepository;
import com.playmate.repository.GameRequestRepository;
import com.playmate.repository.UserRepository;

@Service
public class GameRequestService {

    private final GameRequestRepository gameRequestRepository;
    private final GameRepository gameRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final GameService gameService;

    public GameRequestService(GameRequestRepository gameRequestRepository, GameRepository gameRepository, UserRepository userRepository, NotificationService notificationService, MessageService messageService, GameService gameService) {
        this.gameRequestRepository = gameRequestRepository;
        this.gameRepository = gameRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.gameService = gameService;
    }

    @Transactional
    public GameRequest createRequest(Long gameId, String firebaseUid, String message) {
        Game game = gameRepository.findById(gameId).orElseThrow(() -> new RuntimeException("Game not found"));

        if (Boolean.TRUE.equals(game.getIsCancelled())) {
            throw new RuntimeException("Cannot request a cancelled game");
        }

        // Enforce 10-minute deadline: no requests within 10 min of game start
        if (game.getGameDateTime() != null) {
            LocalDateTime deadline = game.getGameDateTime().minusMinutes(10);
            if (LocalDateTime.now().isAfter(deadline)) {
                throw new RuntimeException("Request deadline has passed (10 min before game start)");
            }
        }

        User requester = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> new RuntimeException("User not found with Firebase UID"));

        // Prevent duplicate request
        gameRequestRepository.findByGameIdAndRequesterId(gameId, requester.getId()).ifPresent(r -> {
            throw new RuntimeException("You have already requested to join this game");
        });

        // Overlap check: user must not have another active game overlapping on the same day
        if (game.getGameDateTime() != null) {
            Integer durVal = game.getDurationMinutes();
            int dur = durVal != null ? durVal : 60;
            gameService.checkNoOverlappingGame(requester.getId(), game.getGameDateTime(), dur, gameId);
        }

        // Check available slots considering pending requests
        int pending = gameRequestRepository.findByGameIdAndStatus(gameId, GameRequest.RequestStatus.PENDING).size();
        Integer mp = game.getMaxPlayers();
        Integer cp = game.getCurrentPlayers();
        int available = (mp != null ? mp : 0) - (cp != null ? cp : 0) - pending;
        if (available <= 0) {
            throw new RuntimeException("No available slots");
        }

        GameRequest req = new GameRequest();
        req.setGame(game);
        req.setRequester(requester);
        req.setStatus(GameRequest.RequestStatus.PENDING);
        req.setMessage(message);
        req.setCreatedAt(LocalDateTime.now());
        req.setUpdatedAt(LocalDateTime.now());

        GameRequest saved = gameRequestRepository.save(req);

        // Notify host
        notificationService.createNotification(
            game.getCreatedBy(),
            Notification.NotificationType.GAME_REQUEST,
            "Join Request \uD83C\uDFAE",
            requester.getName() + " requested to join \"" + game.getTitle() + "\"",
            game.getId(),
            "GAME"
        );

        return saved;
    }

    public List<GameRequest> listRequestsForGame(Long gameId) {
        return gameRequestRepository.findByGameId(gameId);
    }

    public List<GameRequest> listRequestsForHost(Long hostUserId) {
        return gameRequestRepository.findByGameCreatedBy(hostUserId);
    }

    public List<GameRequest> listRequestsByRequester(Long requesterId) {
        return gameRequestRepository.findByRequesterId(requesterId);
    }

    @Transactional
    public GameRequest acceptRequest(Long gameId, Long requestId, Long actingUserId) {
        Game game = gameRepository.findById(gameId).orElseThrow(() -> new RuntimeException("Game not found"));
        if (!game.getCreatedBy().equals(actingUserId)) {
            throw new RuntimeException("Only host can accept requests");
        }

        GameRequest req = gameRequestRepository.findById(requestId).orElseThrow(() -> new RuntimeException("Request not found"));
        if (!req.getGame().getId().equals(gameId)) throw new RuntimeException("Request does not belong to this game");
        if (req.getStatus() != GameRequest.RequestStatus.PENDING) throw new RuntimeException("Request is not pending");

        User requester = req.getRequester();

        if (game.getParticipants().contains(requester)) {
            req.setStatus(GameRequest.RequestStatus.REJECTED);
            req.setUpdatedAt(LocalDateTime.now());
            return gameRequestRepository.save(req);
        }

        Integer cpVal = game.getCurrentPlayers();
        Integer mpVal = game.getMaxPlayers();
        int currentPlayers = cpVal != null ? cpVal : 0;
        int maxPlayers = mpVal != null ? mpVal : 0;
        if (currentPlayers >= maxPlayers) {
            throw new RuntimeException("Game is already full");
        }

        // Re-check overlap at acceptance time (requester's schedule may have changed)
        if (game.getGameDateTime() != null) {
            Integer durVal = game.getDurationMinutes();
            int dur = durVal != null ? durVal : 60;
            gameService.checkNoOverlappingGame(requester.getId(), game.getGameDateTime(), dur, gameId);
        }

        game.getParticipants().add(requester);
        game.setCurrentPlayers(currentPlayers + 1);
        gameRepository.save(game);

        req.setStatus(GameRequest.RequestStatus.ACCEPTED);
        req.setUpdatedAt(LocalDateTime.now());
        req.setRespondedAt(LocalDateTime.now());
        GameRequest saved = gameRequestRepository.save(req);

        // Notify requester
        notificationService.createNotification(
            requester.getId(),
            Notification.NotificationType.GAME_ACCEPTED,
            "You're In! \u2705",
            "Your request to join \"" + game.getTitle() + "\" was accepted",
            game.getId(),
            "GAME"
        );

        // Auto-send a welcome DM from host to accepted player so both see each other in inbox
        try {
            messageService.sendAutoWelcomeDm(actingUserId, requester.getId(), game.getTitle());
        } catch (Exception e) {
            // Non-critical — don't fail the acceptance if DM fails
            System.err.println("[GameRequestService] Auto-welcome DM failed: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public GameRequest rejectRequest(Long gameId, Long requestId, Long actingUserId, String reason) {
        Game game = gameRepository.findById(gameId).orElseThrow(() -> new RuntimeException("Game not found"));
        if (!game.getCreatedBy().equals(actingUserId)) {
            throw new RuntimeException("Only host can reject requests");
        }

        GameRequest req = gameRequestRepository.findById(requestId).orElseThrow(() -> new RuntimeException("Request not found"));
        if (!req.getGame().getId().equals(gameId)) throw new RuntimeException("Request does not belong to this game");
        if (req.getStatus() != GameRequest.RequestStatus.PENDING) throw new RuntimeException("Request is not pending");

        req.setStatus(GameRequest.RequestStatus.REJECTED);
        req.setMessage((req.getMessage() != null ? req.getMessage() + "\n" : "") + "Reason: " + (reason != null ? reason : ""));
        req.setUpdatedAt(LocalDateTime.now());
        req.setRespondedAt(LocalDateTime.now());
        GameRequest saved = gameRequestRepository.save(req);

        // Notify requester
        notificationService.createNotification(
            req.getRequester().getId(),
            Notification.NotificationType.GAME_REJECTED,
            "Request Declined",
            "Your request to join \"" + game.getTitle() + "\" was not accepted",
            game.getId(),
            "GAME"
        );

        return saved;
    }
}
