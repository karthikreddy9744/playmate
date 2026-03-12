package com.playmate.admin;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.entity.Game;
import com.playmate.entity.User;
import com.playmate.service.AdminService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/stats/users")
    public ResponseEntity<Map<String, Long>> getUserStats() {
        return ResponseEntity.ok(adminService.getUserStats());
    }

    @GetMapping("/stats/games")
    public ResponseEntity<Map<String, Object>> getGameStats() {
        return ResponseEntity.ok(adminService.getGameStats());
    }

    @GetMapping("/stats/revenue")
    public ResponseEntity<List<Map<String, Object>>> getRevenueData() {
        return ResponseEntity.ok(adminService.getRevenueData());
    }

    @GetMapping("/stats/sport-distribution")
    public ResponseEntity<List<Map<String, Object>>> getSportDistribution() {
        return ResponseEntity.ok(adminService.getSportDistribution());
    }

    @GetMapping("/stats/lifecycle")
    public ResponseEntity<Map<String, Object>> getGameLifecycle() {
        return ResponseEntity.ok(adminService.getGameLifecycle());
    }

    @GetMapping("/stats/area")
    public ResponseEntity<List<Map<String, Object>>> getAreaAnalytics() {
        return ResponseEntity.ok(adminService.getAreaAnalytics());
    }

    @GetMapping("/stats/sentiment")
    public ResponseEntity<Map<String, Object>> getFeedbackSentiment() {
        return ResponseEntity.ok(adminService.getFeedbackSentiment());
    }

    @GetMapping("/stats/trend")
    public ResponseEntity<List<Map<String, Object>>> getGameCreationTrend() {
        return ResponseEntity.ok(adminService.getGameCreationTrend(30));
    }

    @GetMapping("/stats/retention")
    public ResponseEntity<Map<String, Object>> getUserRetention() {
        return ResponseEntity.ok(adminService.getUserRetention());
    }

    @GetMapping("/stats/sport-lifecycle")
    public ResponseEntity<List<Map<String, Object>>> getSportLifecycle() {
        return ResponseEntity.ok(adminService.getSportLifecycle());
    }

    @GetMapping("/activity/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentActivity() {
        return ResponseEntity.ok(adminService.getRecentActivity());
    }

    // ── New Analytics Endpoints ────────────────────────────────────

    @GetMapping("/stats/requests")
    public ResponseEntity<Map<String, Object>> getRequestStats() {
        return ResponseEntity.ok(adminService.getRequestStats());
    }

    @GetMapping("/stats/messaging")
    public ResponseEntity<Map<String, Object>> getMessagingStats() {
        return ResponseEntity.ok(adminService.getMessagingStats());
    }

    @GetMapping("/stats/host-leaderboard")
    public ResponseEntity<List<Map<String, Object>>> getHostLeaderboard() {
        return ResponseEntity.ok(adminService.getHostLeaderboard());
    }

    @GetMapping("/stats/player-leaderboard")
    public ResponseEntity<List<Map<String, Object>>> getPlayerLeaderboard() {
        return ResponseEntity.ok(adminService.getPlayerLeaderboard());
    }

    @GetMapping("/stats/no-shows")
    public ResponseEntity<List<Map<String, Object>>> getNoShowTracking() {
        return ResponseEntity.ok(adminService.getNoShowTracking());
    }

    @GetMapping("/stats/verification")
    public ResponseEntity<Map<String, Object>> getVerificationStats() {
        return ResponseEntity.ok(adminService.getVerificationStats());
    }

    @GetMapping("/stats/peak-hours")
    public ResponseEntity<List<Map<String, Object>>> getPeakHours() {
        return ResponseEntity.ok(adminService.getPeakHours());
    }

    @GetMapping("/stats/fill-rate")
    public ResponseEntity<Map<String, Object>> getAvgFillRate() {
        return ResponseEntity.ok(adminService.getAvgFillRate());
    }

    @GetMapping("/stats/system-health")
    public ResponseEntity<Map<String, Object>> getSystemHealth() {
        return ResponseEntity.ok(adminService.getSystemHealth());
    }

    // User Management Endpoints
    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return adminService.getUserById(id)
                .map(user -> ResponseEntity.ok(user))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        User updatedUser = adminService.updateUser(id, userDetails);
        return ResponseEntity.ok(updatedUser);
    }

    @PatchMapping("/users/{id}")
    public ResponseEntity<User> patchUser(@PathVariable Long id, @RequestBody Map<String, Object> updates) {
        User updatedUser = adminService.patchUser(id, updates);
        return ResponseEntity.ok(updatedUser);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    // Game Management Endpoints
    @GetMapping("/games")
    public ResponseEntity<List<Game>> getAllGames() {
        return ResponseEntity.ok(adminService.getAllGames());
    }

    @GetMapping("/games/{id}")
    public ResponseEntity<Game> getGameById(@PathVariable Long id) {
        return adminService.getGameById(id)
                .map(game -> ResponseEntity.ok(game))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/games/{id}")
    public ResponseEntity<Game> updateGame(@PathVariable Long id, @RequestBody Game gameDetails) {
        Game updatedGame = adminService.updateGame(id, gameDetails);
        return ResponseEntity.ok(updatedGame);
    }

    @PatchMapping("/games/{id}")
    public ResponseEntity<Game> patchGame(@PathVariable Long id, @RequestBody Map<String, Object> updates) {
        Game updatedGame = adminService.patchGame(id, updates);
        return ResponseEntity.ok(updatedGame);
    }

    @DeleteMapping("/games/{id}")
    public ResponseEntity<Void> deleteGame(@PathVariable Long id) {
        adminService.deleteGame(id);
        return ResponseEntity.noContent().build();
    }
}
