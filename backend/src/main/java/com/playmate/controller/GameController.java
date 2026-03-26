package com.playmate.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.dto.CreateGameRequest;
import com.playmate.dto.GameRequestResponse;
import com.playmate.dto.GameResponse;
import com.playmate.dto.JoinGameRequest;
import com.playmate.entity.User;
import com.playmate.repository.UserRepository;
import com.playmate.service.GameRequestService;
import com.playmate.service.GameService;

@RestController
@RequestMapping("/api/games")
public class GameController {
  private final UserRepository userRepository;
  private final GameService gameService;
  private final GameRequestService gameRequestService;

  public GameController(UserRepository userRepository, GameService gameService, GameRequestService gameRequestService) {
    this.userRepository = userRepository;
    this.gameService = gameService;
    this.gameRequestService = gameRequestService;
  }

  @GetMapping("/requests/mine")
  public ResponseEntity<?> myRequests() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    return ResponseEntity.ok(
      java.util.Map.of(
        "requestsByMe", gameRequestService.listRequestsByRequester(user.getId()),
        "requestsToMyGames", gameRequestService.listRequestsForHost(user.getId())
      )
    );
  }

  @PostMapping
  public ResponseEntity<GameResponse> create(@RequestBody CreateGameRequest request) {
    // Extract authenticated user from JWT
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    GameResponse saved = gameService.createGame(request, user.getId());
    return ResponseEntity.ok(saved);
  }

  @GetMapping
  public ResponseEntity<List<GameResponse>> list(
        @RequestParam(required = false) String sport,
        @RequestParam(required = false) String skillLevel,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(required = false) String lat,
        @RequestParam(required = false) String lng,
        @RequestParam(required = false) String radius,
        @RequestParam(required = false) String availableOnly,
        @RequestParam(required = false) String sortByDistance) {
    
    Double latVal = parseDouble(lat);
    Double lngVal = parseDouble(lng);
    Double radVal = parseDouble(radius);
    boolean avail = "true".equalsIgnoreCase(availableOnly);
    boolean sort = "true".equalsIgnoreCase(sortByDistance);

    return ResponseEntity.ok(gameService.discoverGames(sport, skillLevel, from, to, latVal, lngVal, radVal, avail, sort));
  }

  private Double parseDouble(String value) {
    if (value == null || value.isBlank() || "undefined".equals(value) || "null".equals(value)) {
      return null;
    }
    try {
      return Double.valueOf(value);
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  @GetMapping("/{id}")
  public ResponseEntity<GameResponse> getById(@PathVariable Long id) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    Long userId = null;
    if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
      String email = auth.getName();
      userId = userRepository.findByEmail(email).map(User::getId).orElse(null);
    }
    return ResponseEntity.ok(gameService.getGameById(id, userId));
  }

  @GetMapping("/sport/{sport}")
  public ResponseEntity<List<GameResponse>> bySport(@PathVariable String sport) {
    return ResponseEntity.ok(gameService.getGamesBySport(sport));
  }

  /** Check if a given user is a participant of the game */
  @GetMapping("/{gameId}/isParticipant/{userId}")
  public ResponseEntity<Boolean> isParticipant(@PathVariable Long gameId, @PathVariable Long userId) {
    boolean result;
    try {
      result = gameService.isUserParticipant(gameId, userId);
    } catch (Exception e) {
      result = false;
    }
    return ResponseEntity.ok(result);
  }

  /** Get participants list (id + name + profilePicture) for a game */
  @GetMapping("/{gameId}/participants")
  public ResponseEntity<java.util.List<java.util.Map<String, Object>>> getParticipants(@PathVariable Long gameId) {
    return ResponseEntity.ok(gameService.getGameParticipants(gameId));
  }

  @GetMapping("/upcoming")
  public ResponseEntity<List<GameResponse>> upcoming(@RequestParam("from") String from,
                                             @RequestParam("to") String to) {
    LocalDateTime f = null;
    LocalDateTime t = null;
    try {
        if (from != null && !from.isBlank() && !"undefined".equals(from)) f = LocalDateTime.parse(from);
        if (to != null && !to.isBlank() && !"undefined".equals(to)) t = LocalDateTime.parse(to);
    } catch (java.time.format.DateTimeParseException e) {
        // Fallback or empty list
        return ResponseEntity.ok(java.util.Collections.emptyList());
    }
    return ResponseEntity.ok(gameService.getUpcomingGames(f, t));
  }

  /** Get games where the current user is a participant or host (visible regardless of deadline) */
  @GetMapping("/mine")
  public ResponseEntity<List<GameResponse>> myGames() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    return ResponseEntity.ok(gameService.getMyGames(user.getId()));
  }

  /** Create a join request (reserves a slot until host accepts/rejects) */
  @PostMapping("/{gameId}/requests")
  public ResponseEntity<GameRequestResponse> requestToJoin(@PathVariable Long gameId, @RequestBody JoinGameRequest request) {
    GameRequestResponse req = gameRequestService.createRequest(gameId, request.getFirebaseUid(), request.getMessage());
    return ResponseEntity.ok(req);
  }

  /** List all requests for a game (host view) */
  @GetMapping("/{gameId}/requests")
  public ResponseEntity<List<GameRequestResponse>> listRequests(@PathVariable Long gameId) {
    return ResponseEntity.ok(gameRequestService.listRequestsForGame(gameId));
  }

  @PostMapping("/{gameId}/requests/{requestId}/accept")
  public ResponseEntity<GameRequestResponse> acceptRequest(@PathVariable Long gameId, @PathVariable Long requestId) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    GameRequestResponse saved = gameRequestService.acceptRequest(gameId, requestId, user.getId());
    return ResponseEntity.ok(saved);
  }

  @PostMapping("/{gameId}/requests/{requestId}/reject")
  public ResponseEntity<GameRequestResponse> rejectRequest(@PathVariable Long gameId, @PathVariable Long requestId, @RequestBody(required = false) String body) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    GameRequestResponse saved = gameRequestService.rejectRequest(gameId, requestId, user.getId(), body);
    return ResponseEntity.ok(saved);
  }

  @PostMapping("/{gameId}/cancel")
  public ResponseEntity<Void> cancelGame(@PathVariable Long gameId) {
    // Extract authenticated user from JWT
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User cancelUser = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    gameService.cancelGame(gameId, cancelUser.getId());
    return ResponseEntity.ok().build();
  }

  /** Delete a game (host only) */
  @DeleteMapping("/{gameId}")
  public ResponseEntity<Void> deleteGame(@PathVariable Long gameId) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String email = auth.getName();
    User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    gameService.deleteGame(gameId, user.getId());
    return ResponseEntity.ok().build();
  }
}
