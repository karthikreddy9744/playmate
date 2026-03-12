package com.playmate.controller;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.entity.User;
import com.playmate.repository.UserRepository;

/**
 * Dev-only endpoint to create an admin account for CI/e2e runs.
 * Activated only when `app.dev.seed.enabled=true` in environment.
 */
@RestController
@RequestMapping("/internal/dev")
public class AdminSeedController {

    // Default to enabled in local/dev environments to make CI/E2E easier.
    // Controller still enforces dev-only intent; toggle via env when needed.
    @Value("${app.dev.seed.enabled:true}")
    private boolean seedEnabled;

    @Autowired private UserRepository userRepository;
    @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @PostMapping("/seed-admin")
    public ResponseEntity<?> seedAdmin() {
        if (!seedEnabled) return ResponseEntity.status(404).body("Dev seeding disabled");

        String adminEmail = "admin+dev@example.com";
        Optional<User> existing = userRepository.findByEmailOptional(adminEmail);
        if (existing.isPresent()) return ResponseEntity.ok("Already seeded");

        User u = new User();
        u.setName("Dev Admin");
        u.setEmail(adminEmail);
        u.setRole("ADMIN");
        u.setVerifiedEmail(true);
        // Satisfy non-null firebaseUid constraint with a unique dev UID
        u.setFirebaseUid("dev-admin-" + java.util.UUID.randomUUID().toString());
        // Set password hash using application's PasswordEncoder
        u.setPasswordHash(passwordEncoder.encode("dev-admin"));
        userRepository.save(u);
        return ResponseEntity.ok("Seeded admin");
    }
}
