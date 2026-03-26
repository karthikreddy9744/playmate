package com.playmate.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.dto.CreateGameRequest;
import com.playmate.dto.GameResponse;
import com.playmate.entity.Game;
import com.playmate.entity.Notification;
import com.playmate.entity.SkillLevel;
import com.playmate.entity.SportType;
import com.playmate.entity.User;
import com.playmate.exception.EmailNotVerifiedException;
import com.playmate.exception.GameNotFoundException;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.GameRepository;
import com.playmate.repository.GameRequestRepository;
import com.playmate.repository.RatingRepository;
import com.playmate.repository.UserRepository;

@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);

    @Autowired
    private GameRepository gameRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GameRequestRepository gameRequestRepository;

    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MessageService messageService;

    public GameResponse createGame(CreateGameRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + userId));

        if (!Boolean.TRUE.equals(user.getVerifiedEmail())) {
            throw new EmailNotVerifiedException("Email must be verified to create a game.");
        }

        Game game = new Game();
        game.setTitle(request.getTitle() != null ? request.getTitle() : request.getSport() + " Game");
        game.setDescription(request.getDescription() != null ? request.getDescription() : request.getNotes());

        // Map sport string to SportType enum
        try {
            game.setSportType(SportType.valueOf(request.getSport().toUpperCase().replace(" ", "_")));
        } catch (IllegalArgumentException e) {
            game.setSportType(SportType.OTHER);
        }

        // Map skill level
        if (request.getSkillLevel() != null) {
            try {
                game.setSkillLevel(SkillLevel.valueOf(request.getSkillLevel().toUpperCase().replace(" ", "_")));
            } catch (IllegalArgumentException e) {
                game.setSkillLevel(SkillLevel.ALL_LEVELS);
            }
        }

        // Parse datetime
        if (request.getStartTime() != null) {
            game.setGameDateTime(LocalDateTime.parse(request.getStartTime()));
        }

        game.setDurationMinutes(Objects.requireNonNullElse(request.getDurationMinutes(), 60));
        int maxP = Objects.requireNonNullElse(request.getTotalSlots(), 10);
        if (maxP > 40) maxP = 40; // Hard cap for group-chat sanity
        
        // Use alreadyConfirmed from creator (includes themselves + friends already coming)
        int confirmed = Objects.requireNonNullElse(request.getAlreadyConfirmed(), 1);
        
        // Validation
        if (confirmed >= maxP) {
            throw new RuntimeException("Confirmed players cannot be greater than or equal to total slots.");
        }
        if (game.getDurationMinutes() != null && game.getDurationMinutes() < 20) {
            throw new RuntimeException("Game duration must be at least 20 minutes.");
        }
        
        game.setMaxPlayers(maxP);
        game.setCurrentPlayers(confirmed);
        // Add host user as an accepted participant so messaging and participant checks work
        game.getParticipants().add(user);
        game.setLocationLat(Objects.requireNonNullElse(request.getLocationLat(), BigDecimal.ZERO));
        game.setLocationLng(Objects.requireNonNullElse(request.getLocationLng(), BigDecimal.ZERO));
        game.setLocationAddress(Objects.requireNonNullElse(request.getLocationAddress(), "TBD"));
        game.setLocationCity(Objects.requireNonNullElse(request.getLocationCity(), "Unknown"));
        game.setPricePerPlayer(Objects.requireNonNullElse(request.getCostPerPerson(), BigDecimal.ZERO));
        game.setEquipmentProvided(Objects.requireNonNullElse(request.getEquipmentProvided(), false));
        game.setEquipmentDetails(request.getEquipmentDetails());
        game.setIsPublic(Objects.requireNonNullElse(request.getIsPublic(), true));
        game.setRatingRequired(Objects.requireNonNullElse(request.getRatingRequired(), false));
        game.setMinRating(Objects.requireNonNullElse(request.getMinRating(), BigDecimal.ZERO));
        game.setCreatedBy(userId);
        game.setCreatedAt(LocalDateTime.now());
        game.setUpdatedAt(LocalDateTime.now());

        // Overlap check: creator can't have another active game on the same time
        if (game.getGameDateTime() != null) {
            Integer durVal = game.getDurationMinutes();
            checkNoOverlappingGame(userId, game.getGameDateTime(),
                    durVal != null ? durVal : 60, null);
        }

        Game saved = gameRepository.save(game);
        
        // Host reliability: increment gamesCreated
        user.setGamesCreated(Objects.requireNonNullElse(user.getGamesCreated(), 0) + 1);
        updateHostReliability(user);
        userRepository.save(user);

        return toGameResponse(saved);
    }

    public List<GameResponse> getAllGames() {
        // Public discover: show non-cancelled games whose request deadline (10 min before start) hasn't passed
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime window = now.minusHours(4);
        return gameRepository
                .findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(window)
                .stream()
                .filter(g -> {
                    // Hide from discover once 10 min before start
                    LocalDateTime deadline = g.getGameDateTime().minusMinutes(10);
                    return now.isBefore(deadline);
                })
                .map(this::toGameResponse)
                .collect(Collectors.toList());
    }

    /** Filtered game discovery with all filter criteria applied server-side */
    @Transactional(readOnly = true)
    public List<GameResponse> discoverGames(String sportFilter, String skillLevelFilter,
            String from, String to, Double lat, Double lng, Double radiusKm,
            boolean availableOnly, boolean sortByDistance) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime window = now.minusHours(4);

        Stream<Game> stream = gameRepository
                .findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(window)
                .stream()
                .filter(g -> {
                    LocalDateTime deadline = g.getGameDateTime().minusMinutes(10);
                    return now.isBefore(deadline);
                });

        // Sport filter (comma-separated list)
        if (sportFilter != null && !sportFilter.isBlank()) {
            Set<SportType> sports = Arrays.stream(sportFilter.split(","))
                    .map(s -> { try { return SportType.valueOf(s.trim().toUpperCase()); }
                                catch (IllegalArgumentException e) { return null; } })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (!sports.isEmpty()) {
                stream = stream.filter(g -> g.getSportType() != null && sports.contains(g.getSportType()));
            }
        }

        // Skill level filter (exact match; ALL_LEVELS games always shown)
        if (skillLevelFilter != null && !skillLevelFilter.isBlank()
                && !"ALL".equalsIgnoreCase(skillLevelFilter)) {
            try {
                SkillLevel level = SkillLevel.valueOf(skillLevelFilter.toUpperCase().replace(" ", "_"));
                stream = stream.filter(g ->
                        g.getSkillLevel() == null
                        || g.getSkillLevel() == SkillLevel.ALL_LEVELS
                        || g.getSkillLevel() == level);
            } catch (IllegalArgumentException ignored) {}
        }

        // Date range filter
        if (from != null && !from.isBlank() && !"undefined".equals(from) && !"null".equals(from)) {
            try {
                LocalDateTime fromDt = LocalDateTime.parse(from);
                stream = stream.filter(g -> g.getGameDateTime() != null && !g.getGameDateTime().isBefore(fromDt));
            } catch (java.time.format.DateTimeParseException e) {
                log.warn("Invalid 'from' date format: {}", from);
            }
        }
        if (to != null && !to.isBlank() && !"undefined".equals(to) && !"null".equals(to)) {
            try {
                LocalDateTime toDt = LocalDateTime.parse(to);
                stream = stream.filter(g -> g.getGameDateTime() != null && !g.getGameDateTime().isAfter(toDt));
            } catch (java.time.format.DateTimeParseException e) {
                log.warn("Invalid 'to' date format: {}", to);
            }
        }

        List<GameResponse> responses = stream.map(this::toGameResponse).collect(Collectors.toList());

        // Available slots only
        if (availableOnly) {
            responses = responses.stream()
                    .filter(r -> r.getAvailableSlots() != null && r.getAvailableSlots() > 0)
                    .collect(Collectors.toList());
        }

        // Distance: compute, filter by radius, optionally sort
        if (lat != null && lng != null) {
            for (GameResponse r : responses) {
                if (r.getLocationLat() != null && r.getLocationLng() != null) {
                    r.setDistanceKm(haversineKm(lat, lng,
                            r.getLocationLat().doubleValue(), r.getLocationLng().doubleValue()));
                }
            }
            if (radiusKm != null && radiusKm > 0) {
                responses = responses.stream()
                        .filter(r -> r.getDistanceKm() != null && r.getDistanceKm() <= radiusKm)
                        .collect(Collectors.toList());
            }
            if (sortByDistance) {
                responses.sort(Comparator.comparing(GameResponse::getDistanceKm,
                        Comparator.nullsLast(Comparator.naturalOrder())));
            }
        }

        return responses;
    }

    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Games where the user is host or accepted participant — visible regardless of deadline */
    @Transactional(readOnly = true)
    public List<GameResponse> getMyGames(Long userId) {
        LocalDateTime window = LocalDateTime.now().minusHours(4);
        return gameRepository
                .findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(window)
                .stream()
                .filter(g -> {
                    // Include if user is creator
                    if (g.getCreatedBy().equals(userId)) return true;
                    // Include if user is a participant
                    return g.getParticipants() != null && g.getParticipants().stream().anyMatch(u -> u.getId().equals(userId));
                })
                .filter(g -> {
                    LocalDateTime end = g.getGameDateTime().plusMinutes(
                            g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60);
                    return LocalDateTime.now().isBefore(end);
                })
                .map(g -> toGameResponse(g, userId))
                .collect(Collectors.toList());
    }

    /** Admin use: returns ALL games regardless of status */
    public List<GameResponse> getAllGamesAdmin() {
        return gameRepository.findAll().stream()
                .map(this::toGameResponse)
                .collect(Collectors.toList());
    }

    public GameResponse getGameById(Long id) {
        return getGameById(id, null);
    }

    public GameResponse getGameById(Long id, Long currentUserId) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> new GameNotFoundException("Game not found with id: " + id));
        return toGameResponse(game, currentUserId);
    }

    /** Check whether a given user is a participant of the game (accepted) */
    public boolean isUserParticipant(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found with id: " + gameId));
        return game.getParticipants() != null && game.getParticipants().stream().anyMatch(u -> u.getId().equals(userId));
    }

    /** Return basic info (id + name) for all participants of a game */
    public List<java.util.Map<String, Object>> getGameParticipants(Long gameId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found with id: " + gameId));
        if (game.getParticipants() == null) return java.util.Collections.emptyList();
        // Exclude the game creator from the participants list
        return game.getParticipants().stream()
                .filter(u -> !u.getId().equals(game.getCreatedBy()))
                .map(u -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("profilePictureUrl", u.getProfilePictureUrl());
                    return m;
                })
                .collect(Collectors.toList());
    }

    public List<GameResponse> getGamesBySport(String sport) {
        try {
            LocalDateTime now = LocalDateTime.now();
            SportType sportType = SportType.valueOf(sport.toUpperCase().replace(" ", "_"));
            return gameRepository.findBySportType(sportType).stream()
                    .filter(g -> !Boolean.TRUE.equals(g.getIsCancelled()))
                    .filter(g -> {
                        if (g.getGameDateTime() == null) return true;
                        LocalDateTime deadline = g.getGameDateTime().minusMinutes(10);
                        return now.isBefore(deadline);
                    })
                    .map(this::toGameResponse)
                    .collect(Collectors.toList());
        } catch (IllegalArgumentException e) {
            return List.of();
        }
    }

    public List<GameResponse> getUpcomingGames(LocalDateTime from, LocalDateTime to) {
        return gameRepository.findUpcomingBetween(from, to).stream()
                .filter(g -> !Boolean.TRUE.equals(g.getIsCancelled()))
                .map(this::toGameResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void cancelGame(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found"));

        if (!game.getCreatedBy().equals(userId)) {
            throw new RuntimeException("Only the host can cancel this game");
        }

        LocalDateTime now = LocalDateTime.now();
        
        // CASE 4: DELETE AFTER GAME START
        if (now.isAfter(game.getGameDateTime())) {
            // Convert action to archive, do not cancel
            game.setStatus(Game.GameStatus.ARCHIVED);
            game.setUpdatedAt(now);
            gameRepository.save(game);
            
            // Absolute deletion as per user requirement
            messageService.purgeGameMessages(gameId);
            return;
        }

        // CASE 1 & 2: DELETE BEFORE OR CLOSE TO START
        game.setIsCancelled(true);
        game.setStatus(Game.GameStatus.CANCELLED);
        game.setCancelledAt(now);
        game.setUpdatedAt(now);
        gameRepository.save(game);

        // Host reliability tracking
        User host = userRepository.findById(userId).orElse(null);
        if (host != null) {
            host.setGamesCancelled(Objects.requireNonNullElse(host.getGamesCancelled(), 0) + 1);
            
            // CASE 2: LAST-MINUTE CANCELLATION (within 2 hours)
            if (game.getGameDateTime().minusHours(2).isBefore(now)) {
                host.setLastMinuteCancellations(Objects.requireNonNullElse(host.getLastMinuteCancellations(), 0) + 1);
            }
            
            updateHostReliability(host);
            userRepository.save(host);
        }

        // CASE 3: DELETE WITH NO PARTICIPANTS
        if (game.getParticipants() == null || game.getParticipants().isEmpty()) {
            messageService.purgeGameMessages(gameId);
            return;
        }

        // Notify participants
        for (User p : game.getParticipants()) {
            notificationService.createNotification(
                p.getId(),
                Notification.NotificationType.GAME_CANCELLED,
                "Game Cancelled",
                "The " + game.getSportType() + " game '" + game.getTitle() + "' has been cancelled by the host.",
                gameId,
                "GAME"
            );
        }

        // Absolute deletion as per user requirement: "should be delated and not visible and not in DB"
        messageService.purgeGameMessages(gameId);
    }

    @Transactional
    public void deleteGame(Long gameId, Long userId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found"));
        if (!game.getCreatedBy().equals(userId)) {
            throw new RuntimeException("Only the host can delete this game");
        }
        
        LocalDateTime now = LocalDateTime.now();
        
        // Soft delete: Mark as cancelled/deleted so history and requests persist for feedback/admin
        game.setIsCancelled(true);
        game.setStatus(Game.GameStatus.CANCELLED);
        game.setUpdatedAt(now);
        gameRepository.save(game);

        // Notify all participants
        for (User participant : game.getParticipants()) {
            if (!participant.getId().equals(userId)) {
                notificationService.createNotification(
                        participant.getId(),
                        Notification.NotificationType.GAME_CANCELLED,
                        "Game Removed",
                        game.getSportType() + " game \"" + game.getTitle() + "\" has been removed by the host",
                        game.getId(),
                        "GAME"
                );
            }
        }
        
        // Absolute deletion as per user requirement: "should be delated and not visible and not in DB"
        messageService.purgeGameMessages(gameId);
    }

    private void updateHostReliability(User host) {
        int created = Objects.requireNonNullElse(host.getGamesCreated(), 0);
        int cancelled = Objects.requireNonNullElse(host.getGamesCancelled(), 0);

        if (created == 0) {
            host.setHostReliabilityScore(BigDecimal.valueOf(100.0));
            return;
        }

        // Penalty for last minute cancellations (extra weight?)
        // Basic formula provided: ((created - cancelled) * 100.0) / created
        double score = ((created - cancelled) * 100.0) / created;
        
        // Ensure score doesn't go below 0
        if (score < 0) score = 0;

        host.setHostReliabilityScore(BigDecimal.valueOf(score).setScale(2, java.math.RoundingMode.HALF_UP));
    }

    private GameResponse toGameResponse(Game game) {
        return toGameResponse(game, null);
    }

    private GameResponse toGameResponse(Game game, Long currentUserId) {
        GameResponse response = new GameResponse();
        response.setId(game.getId());
        response.setTitle(game.getTitle());
        response.setDescription(game.getDescription());
        response.setSport(game.getSportType() != null ? game.getSportType().name() : null);
        response.setSkillLevel(game.getSkillLevel() != null ? game.getSkillLevel().name() : null);
        response.setStartTime(game.getGameDateTime() != null ? game.getGameDateTime().toString() : null);
        response.setDurationMinutes(game.getDurationMinutes());
        response.setTotalSlots(game.getMaxPlayers());
        // Subtract pending requests (reserved but not yet accepted) from available slots
        int pending = 0;
        try {
            if (game.getId() != null) {
                pending = gameRequestRepository.findByGameIdAndStatus(game.getId(), com.playmate.entity.GameRequest.RequestStatus.PENDING).size();
            }
        } catch (Exception e) {
            // fallback to zero pending
            pending = 0;
        }
        // Available slots: currentPlayers includes creator + pre-confirmed friends
        int currentPlayers = Objects.requireNonNullElse(game.getCurrentPlayers(), 1);
        response.setAvailableSlots(game.getMaxPlayers() != null
                ? game.getMaxPlayers() - currentPlayers - pending : 0);
        response.setCostPerPerson(game.getPricePerPlayer());
        response.setLocationLat(game.getLocationLat());
        response.setLocationLng(game.getLocationLng());
        response.setLocationAddress(game.getLocationAddress());
        response.setLocationCity(game.getLocationCity());
        response.setNotes(game.getDescription());
        response.setEquipmentProvided(game.getEquipmentProvided());
        response.setEquipmentDetails(game.getEquipmentDetails());
        response.setCreatedBy(game.getCreatedBy());
        // Resolve creator name for display
        try {
            userRepository.findById(game.getCreatedBy()).ifPresent(creator ->
                response.setCreatedByName(creator.getName())
            );
        } catch (Exception ignored) {}
        response.setCreatedAt(game.getCreatedAt() != null ? game.getCreatedAt().toString() : null);
        response.setUpdatedAt(game.getUpdatedAt() != null ? game.getUpdatedAt().toString() : null);
        response.setIsCancelled(game.getIsCancelled());
        // Exclude the game creator from participant count and IDs (creator is the host, not a participant)
        // But include the pre-confirmed friends in the participant count
        int preConfirmedFriends = currentPlayers - 1;
        long joinedCount = (game.getParticipants() != null
                ? game.getParticipants().stream().filter(u -> !u.getId().equals(game.getCreatedBy())).count()
                : 0) + preConfirmedFriends;
        response.setParticipantCount((int) joinedCount);
        response.setParticipantIds(game.getParticipants() != null
                ? game.getParticipants().stream().map(User::getId).filter(id -> !id.equals(game.getCreatedBy())).collect(java.util.stream.Collectors.toList())
                : java.util.Collections.emptyList());

        // Set hasRated if user ID is provided
        if (currentUserId != null) {
            boolean rated = ratingRepository.existsByRaterIdAndGameId(currentUserId, game.getId());
            response.setHasRated(rated);
        }

        // Compute game status
        String status;
        if (Boolean.TRUE.equals(game.getIsCancelled())) {
            status = "CANCELLED";
        } else if (game.getGameDateTime() == null) {
            status = "UPCOMING";
        } else {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime endTime = game.getGameDateTime().plusMinutes(
                    game.getDurationMinutes() != null ? game.getDurationMinutes().longValue() : 60);
            if (now.isAfter(endTime)) {
                status = "COMPLETED";
            } else if (now.isAfter(game.getGameDateTime())) {
                status = "LIVE";
            } else if (game.getMaxPlayers() != null && currentPlayers >= game.getMaxPlayers()) {
                status = "FULL";
            } else {
                status = "UPCOMING";
            }
        }
        response.setStatus(status);
        return response;
    }

    /**
     * Ensure a user has no overlapping active game on the same day.
     * The blocking window for each game is [startTime, startTime + duration + 30 min].
     * @param excludeGameId game to exclude (e.g. the game being created/joined itself)
     */
    public void checkNoOverlappingGame(Long userId, LocalDateTime targetStart, int targetDurationMinutes, Long excludeGameId) {
        LocalDateTime targetEnd = targetStart.plusMinutes(targetDurationMinutes).plusMinutes(30);

        // Only look at games on the same calendar day
        LocalDateTime dayStart = targetStart.toLocalDate().atStartOfDay();
        LocalDateTime dayEnd   = dayStart.plusDays(1);

        List<Game> sameDayGames = gameRepository.findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(dayStart)
                .stream()
                .filter(g -> g.getGameDateTime() != null && g.getGameDateTime().isBefore(dayEnd))
                .filter(g -> excludeGameId == null || !g.getId().equals(excludeGameId))
                .filter(g -> {
                    boolean isCreator = g.getCreatedBy().equals(userId);
                    boolean isParticipant = g.getParticipants() != null
                            && g.getParticipants().stream().anyMatch(u -> u.getId().equals(userId));
                    return isCreator || isParticipant;
                })
                .toList();

        for (Game g : sameDayGames) {
            long dur = g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60;
            LocalDateTime gStart = g.getGameDateTime();
            LocalDateTime gEnd   = gStart.plusMinutes(dur).plusMinutes(30);

            // Overlap if one starts before the other ends and vice-versa
            if (targetStart.isBefore(gEnd) && targetEnd.isAfter(gStart)) {
                throw new RuntimeException("You already have another game (\"" + g.getTitle()
                        + "\") on the same day that overlaps. Wait for it to complete (+30 min) or cancel it first.");
            }
        }
    }
}
