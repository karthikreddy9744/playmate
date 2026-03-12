package com.playmate.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.scheduler.CleanupScheduler;

@RestController
@RequestMapping("/internal")
public class CleanupController {

    private final CleanupScheduler cleanupScheduler;

    @Value("${internal.cleanup.key:SECRET_KEY}")
    private String cleanupKey;

    public CleanupController(CleanupScheduler cleanupScheduler) {
        this.cleanupScheduler = cleanupScheduler;
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, String>> triggerCleanup(@RequestParam String key) {
        System.out.println("DEBUG: Received cleanup key: " + key);
        System.out.println("DEBUG: Configured cleanup key: " + cleanupKey);
        if (!cleanupKey.equals(key)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("status", "error", "message", "Invalid cleanup key"));
        }

        try {
            cleanupScheduler.purgeMessagesAfterGameEnd();
            return ResponseEntity.ok(Map.of("status", "cleanup executed"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
