package com.playmate.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.dto.GameRequestResponse;
import com.playmate.entity.Game;
import com.playmate.entity.GameRequest;
import com.playmate.entity.Notification;
import com.playmate.entity.User;
import com.playmate.repository.GameRepository;
import com.playmate.repository.GameRequestRepository;
import com.playmate.repository.RatingRepository;
import com.playmate.repository.UserRepository;

@Service
public class GameRequestService {

    private final GameRequestRepository gameRequestRepository;
    private final GameRepository gameRepository;
    private final UserRepository userRepository;
    private final RatingRepository ratingRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final GameService gameService;

    public GameRequestService(GameRequestRepository gameRequestRepository, GameRepository gameRepository, UserRepository userRepository, RatingRepository ratingRepository, NotificationService notificationService, MessageService messageService, GameService gameService) {
        this.gameRequestRepository = gameRequestRepository;
        this.gameRepository = gameRepository;
        this.userRepository = userRepository;
        this.ratingRepository = ratingRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.gameService = gameService;
    }

    @Transactional
    public GameRequestResponse createRequest(Long gameId, String firebaseUid, String message) {
        Game game = gameRepository.findById(gameId).orElseThrow(() -> new RuntimeException("Game not found"));

        if (Boolean.TRUE.equals(game.getIsCancelled())) {
            throw new RuntimeException("Cannot request a cancelled game");
        }

        if (game.getGameDateTime() != null) {
            LocalDateTime deadline = game.getGameDateTime().minusMinutes(10);
            if (LocalDateTime.now().isAfter(deadline)) {
                throw new RuntimeException("Request deadline has passed (10 min before game start)");
            }
        }

        User requester = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> new RuntimeException("User not found with Firebase UID"));

        gameRequestRepository.findByGameIdAndRequesterId(gameId, requester.getId()).ifPresent(r -> {
            throw new RuntimeException("You have already requested to join this game");
        });

        if (game.getGameDateTime() != null) {
            Integer durVal = game.getDurationMinutes();
            int dur = durVal != null ? durVal : 60;
            gameService.checkNoOverlappingGame(requester.getId(), game.getGameDateTime(), dur, gameId);
        }

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

        notificationService.createNotification(
            game.getCreatedBy(),
            Notification.NotificationType.GAME_REQUEST,
            "Join Request \uD83C\uDFAE",
            requester.getName() + " requested to join \"" + game.getTitle() + "\"",
            game.getId(),
            "GAME"
        );

        return toResponse(saved, requester.getId());
    }

    @Transactional(readOnly = true)
    public List<GameRequestResponse> listRequestsForGame(Long gameId) {
        return gameRequestRepository.findByGameId(gameId).stream()
                .map(req -> toResponse(req, null))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameRequestResponse> listRequestsForHost(Long hostUserId) {
        return gameRequestRepository.findByGameCreatedBy(hostUserId).stream()
                .map(req -> toResponse(req, hostUserId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GameRequestResponse> listRequestsByRequester(Long requesterId) {
        return gameRequestRepository.findByRequesterId(requesterId).stream()
                .map(req -> toResponse(req, requesterId))
                .collect(Collectors.toList());
    }

    private GameRequestResponse toResponse(GameRequest req, Long currentUserId) {
        GameRequestResponse res = new GameRequestResponse();
        res.setId(req.getId());
        res.setGameId(req.getGame().getId());
        res.setGameTitle(req.getGame().getTitle());
        res.setRequesterId(req.getRequester().getId());
        res.setRequesterName(req.getRequester().getName());
        res.setRequesterPhotoUrl(req.getRequester().getProfilePictureUrl());
        res.setStatus(req.getStatus().name());
        res.setMessage(req.getMessage());
        res.setCreatedAt(req.getCreatedAt() != null ? req.getCreatedAt().toString() : null);
        res.setRespondedAt(req.getRespondedAt() != null ? req.getRespondedAt().toString() : null);
        
        // Game details for rating logic
        res.setGameStartTime(req.getGame().getGameDateTime() != null ? req.getGame().getGameDateTime().toString() : null);
        res.setGameDurationMinutes(req.getGame().getDurationMinutes());
        
        if (currentUserId != null) {
            Long hostId = req.getGame().getCreatedBy();
            Long raterId = currentUserId;
            Long rateeId;
            
            if (currentUserId.equals(hostId)) {
                // Current user is the host, rating the requester
                rateeId = req.getRequester().getId();
            } else {
                // Current user is the requester, rating the host
                rateeId = hostId;
            }
            
            res.setHasRated(ratingRepository.existsByRaterIdAndRateeIdAndGameId(raterId, rateeId, req.getGame().getId()));
        }
        
        // Populate requester stats
        User requester = req.getRequester();
        if (requester != null) {
            res.setRequesterRating(requester.getAverageRating() != null ? requester.getAverageRating().doubleValue() : 0.0);
            res.setRequesterGamesPlayed(requester.getTotalGamesPlayed());
            res.setRequesterNoShows(requester.getNoShowCount());
            res.setRequesterVerified(requester.getVerifiedEmail());
        }
        return res;
    }

    @Transactional
    public GameRequestResponse acceptRequest(Long gameId, Long requestId, Long actingUserId) {
        Game game = gameRepository.findById(gameId).orElseThrow(() -> new RuntimeException("Game not found"));
        if (!game.getCreatedBy().equals(actingUserId)) {
            throw new RuntimeException("Only host can accept requests");
        }

        if (game.getGameDateTime() != null) {
            LocalDateTime deadline = game.getGameDateTime().minusMinutes(10);
            if (LocalDateTime.now().isAfter(deadline)) {
                throw new RuntimeException("Cannot accept requests — game starts in less than 10 minutes");
            }
        }

        GameRequest req = gameRequestRepository.findById(requestId).orElseThrow(() -> new RuntimeException("Request not found"));
        if (!req.getGame().getId().equals(gameId)) throw new RuntimeException("Request does not belong to this game");
        if (req.getStatus() != GameRequest.RequestStatus.PENDING) throw new RuntimeException("Request is not pending");

        User requester = req.getRequester();

        if (game.getParticipants().contains(requester)) {
            req.setStatus(GameRequest.RequestStatus.REJECTED);
            req.setUpdatedAt(LocalDateTime.now());
            return toResponse(gameRequestRepository.save(req), actingUserId);
        }

        Integer cpVal = game.getCurrentPlayers();
        Integer mpVal = game.getMaxPlayers();
        int currentPlayers = cpVal != null ? cpVal : 0;
        int maxPlayers = mpVal != null ? mpVal : 0;
        if (currentPlayers >= maxPlayers) {
            throw new RuntimeException("Game is already full");
        }

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

        notificationService.createNotification(
            requester.getId(),
            Notification.NotificationType.GAME_ACCEPTED,
            "You're In! \u2705",
            "Your request to join \"" + game.getTitle() + "\" was accepted",
            game.getId(),
            "GAME"
        );

        try {
            messageService.sendAutoWelcomeDm(actingUserId, requester.getId(), game.getTitle());
        } catch (Exception e) {
            System.err.println("[GameRequestService] Auto-welcome DM failed: " + e.getMessage());
        }

        return toResponse(saved, actingUserId);
    }

    @Transactional
    public GameRequestResponse rejectRequest(Long gameId, Long requestId, Long actingUserId, String reason) {
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

        notificationService.createNotification(
            req.getRequester().getId(),
            Notification.NotificationType.GAME_REJECTED,
            "Request Declined",
            "Your request to join \"" + game.getTitle() + "\" was not accepted",
            game.getId(),
            "GAME"
        );

        return toResponse(saved, actingUserId);
    }
}
