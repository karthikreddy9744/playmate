package com.playmate.controller;

import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.dto.AuthResponse;
import com.playmate.dto.LoginRequest;
import com.playmate.dto.RegisterRequest;
import com.playmate.dto.UserResponse;
import com.playmate.entity.User;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.UserRepository;
import com.playmate.service.BrevoEmailService;
import com.playmate.service.FcmService;
import com.playmate.service.JwtService;
import com.playmate.service.OtpService;
import com.playmate.service.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired private AuthenticationManager authenticationManager;
    @Autowired private JwtService jwtService;
    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private OtpService otpService;
    @Autowired private BrevoEmailService brevoEmailService;
    @Autowired private FcmService fcmService;

    // ── Email availability check (pre-registration) ─────────────────────────

    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@org.springframework.web.bind.annotation.RequestParam String email) {
        boolean exists = userRepository.findByEmail(email).isPresent();
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    // ── Standard register/login ────────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            UserResponse user = userService.createUser(request);
            String token = jwtService.generateToken(user.getEmail());
            String refreshToken = jwtService.generateRefreshToken(user.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, refreshToken, user.getId(), user.getEmail(), user.getName(), user.getRole(), user.getVerifiedEmail(), user.getFirebaseUid()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            userService.updateLastLogin(user.getId());
            String token = jwtService.generateToken(user.getEmail());
            String refreshToken = jwtService.generateRefreshToken(user.getEmail());
            
            // Allow login but inform frontend if email verification is still needed
            // (Game creation, joining, and messaging are blocked at the service level for unverified users)
            AuthResponse authResponse = new AuthResponse(token, refreshToken, user.getId(), user.getEmail(), user.getName(), user.getRole(), user.getVerifiedEmail(), user.getFirebaseUid());
            if (!Boolean.TRUE.equals(user.getVerifiedEmail())) {
                java.util.Map<String, Object> resp = new java.util.HashMap<>();
                resp.put("token", token);
                resp.put("refreshToken", refreshToken);
                resp.put("id", user.getId());
                resp.put("email", user.getEmail());
                resp.put("name", user.getName());
                resp.put("role", user.getRole());
                resp.put("verifiedEmail", false);
                resp.put("requiresVerification", true);
                resp.put("firebaseUid", user.getFirebaseUid());
                return ResponseEntity.ok(resp);
            }
            
            return ResponseEntity.ok(authResponse);
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");
        if (refreshToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Refresh token is required"));
        }
        try {
            String email = jwtService.extractUsername(refreshToken);
            if (email != null && jwtService.isTokenValid(refreshToken, email)) {
                return ResponseEntity.ok(Map.of("token", jwtService.generateToken(email)));
            }
            return ResponseEntity.status(401).body(Map.of("error", "Invalid refresh token"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid refresh token"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String authHeader) {
        try {
            String token  = authHeader.replace("Bearer ", "");
            String email  = jwtService.extractUsername(token);
            UserResponse user = userService.getUserByEmail(email);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
    }

    // ── Firebase sync (Google Sign-In / any Firebase auth) ────────────────────

    @PostMapping("/firebase-sync")
    public ResponseEntity<?> syncFirebaseUser(@RequestBody Map<String, String> request) {
        // Debug log incoming payload to help trace name/email issues
        System.out.println("[AuthController] /firebase-sync payload: " + request);
        String firebaseUid = request.get("firebaseUid");
        String email       = request.get("email");
        String name        = request.get("name");
        String photoUrl    = request.get("photoUrl");
        boolean googleSignIn = "google".equalsIgnoreCase(request.get("provider"));

        if (firebaseUid == null || email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "firebaseUid and email are required"));
        }
        String resolvedName = resolveName(name, email);

        // 1) Try to find existing user by firebaseUid
        Optional<User> userOptional = userService.findOptionalUserByFirebaseUid(firebaseUid);

        // 2) If not found by firebaseUid, also check by email (account linking).
        //    This handles the case where a user registered via form (email/password)
        //    and later signs in with Google using the same email, or vice versa.
        if (userOptional.isEmpty()) {
            Optional<User> byEmail = userRepository.findByEmail(email);
            if (byEmail.isPresent()) {
                // Link: update the existing user's firebaseUid to the new one
                User existing = byEmail.get();
                existing.setFirebaseUid(firebaseUid);
                if (photoUrl != null && (existing.getProfilePictureUrl() == null || existing.getProfilePictureUrl().isBlank())) {
                    existing.setProfilePictureUrl(photoUrl);
                }
                userRepository.save(existing);
                userOptional = Optional.of(existing);
                System.out.println("[AuthController] Linked firebaseUid " + firebaseUid + " to existing email user: " + email);
            }
        }

        if (userOptional.isPresent()) {
            // --- EXISTING USER ---
            User existingUser = userOptional.get();
            boolean dirty = false;
            if ((existingUser.getName() == null || existingUser.getName().isBlank()) && resolvedName != null && !resolvedName.isBlank()) {
                existingUser.setName(resolvedName);
                dirty = true;
            }
            if (photoUrl != null && !photoUrl.isBlank() && (existingUser.getProfilePictureUrl() == null || existingUser.getProfilePictureUrl().isBlank())) {
                existingUser.setProfilePictureUrl(photoUrl);
                dirty = true;
            }
            if (dirty) userRepository.save(existingUser);
            userService.updateLastLogin(existingUser.getId());

            UserResponse userResponse = userService.toUserResponse(existingUser);

            // Auto-verify Google sign-in users, but only if they aren't already verified.
            if (googleSignIn && !Boolean.TRUE.equals(userResponse.getVerifiedEmail())) {
                userResponse = userService.markEmailVerified(firebaseUid);
            }

            String token = jwtService.generateToken(userResponse.getEmail());
            String refreshToken = jwtService.generateRefreshToken(userResponse.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, refreshToken, userResponse.getId(), userResponse.getEmail(), userResponse.getName(), userResponse.getRole(), userResponse.getVerifiedEmail(), userResponse.getFirebaseUid()));

        } else {
            // --- NEW USER ---
            RegisterRequest reg = new RegisterRequest();
            reg.setFirebaseUid(firebaseUid);
            reg.setEmail(email);
            reg.setName(resolvedName);
            reg.setPassword("firebase_" + firebaseUid); // Set a default secure password
            if (photoUrl != null) reg.setProfilePictureUrl(photoUrl);

            UserResponse newUser;
            // Only auto-verify for Google sign-ins. Other Firebase-authenticated users
            // (e.g., email/password) should go through OTP verification in Profile.
            if (googleSignIn) {
                newUser = userService.createFirebaseUser(reg);
            } else {
                newUser = userService.createUser(reg);
            }

            String token = jwtService.generateToken(newUser.getEmail());
            String refreshToken = jwtService.generateRefreshToken(newUser.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, refreshToken, newUser.getId(), newUser.getEmail(), newUser.getName(), newUser.getRole(), newUser.getVerifiedEmail(), newUser.getFirebaseUid()));
        }
    }

    private String resolveName(String name, String email) {
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        if (email != null && email.contains("@")) {
            return email.substring(0, email.indexOf('@'));
        }
        return "PlayMate User";
    }

    // ── FCM device token registration ─────────────────────────────────────────

    /**
     * POST /api/auth/fcm-token
     * Body: { "firebaseUid": "...", "fcmToken": "..." }
     * Call this on every app open / token refresh from the frontend.
     */
    @PostMapping("/fcm-token")
    public ResponseEntity<?> registerFcmToken(@RequestBody Map<String, String> request) {
        String firebaseUid = request.get("firebaseUid");
        String fcmToken    = request.get("fcmToken");
        if (firebaseUid == null || fcmToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "firebaseUid and fcmToken are required"));
        }
        userService.updateFcmToken(firebaseUid, fcmToken);
        return ResponseEntity.ok(Map.of("message", "FCM token registered"));
    }

    // ── Email OTP ─────────────────────────────────────────────────────────────

    /**
     * POST /api/auth/send-email-otp
     * Body: { "email": "user@example.com", "name": "username" }
     * Sends a 6-digit OTP to the given email via Brevo.
     */
    @PostMapping("/send-email-otp")
    public ResponseEntity<?> sendEmailOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String name  = request.getOrDefault("name", "Player");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "email is required"));
        }

        // Rate-limit: if OTP is still pending, block resend for the full 5-minute window.
        if (otpService.isOtpPending(email) && otpService.getTtlSeconds(email) > 0) {
            return ResponseEntity.status(429).body(Map.of(
                    "error", "OTP already sent. Please wait before requesting a new one.",
                    "ttl", otpService.getTtlSeconds(email)));
        }

        String otp = otpService.generateAndStore(email);

        String html = buildOtpEmailHtml(name, otp);
        boolean sent = brevoEmailService.sendEmail(email, name, "Your PlayMate Verification Code", html);

        if (!sent) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to send OTP email. Please try again."));
        }

        return ResponseEntity.ok(Map.of("message", "OTP sent to " + email, "expires_in_seconds", 300));
    }

    /**
     * POST /api/auth/verify-email-otp
     * Body: { "firebaseUid": "...", "email": "...", "otp": "123456" }
     * Verifies the OTP and marks the user's email as verified.
     */
    @PostMapping("/verify-email-otp")
    public ResponseEntity<?> verifyEmailOtp(@RequestBody Map<String, String> request) {
        String firebaseUid = request.get("firebaseUid");
        String email       = request.get("email");
        String otp         = request.get("otp");

        if (email == null || otp == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "email and otp are required"));
        }

        if (!otpService.verify(email, otp)) {
            return ResponseEntity.status(400).body(Map.of("error", "Invalid or expired OTP"));
        }

        UserResponse updated;
        if (firebaseUid != null) {
            try {
                updated = userService.markEmailVerified(firebaseUid);
                // Send welcome push notification for firebase users
                userRepository.findByFirebaseUid(firebaseUid).ifPresent(u -> {
                    if (u.getFcmToken() != null) {
                        fcmService.notifyVerified(u.getFcmToken(), u.getName());
                    }
                });
            } catch (UserNotFoundException unfe) {
                // Race: firebaseUid not yet synced into our DB. Fallback to email-based verification.
                System.out.println("[AuthController] verify-email-otp: firebaseUid not found, falling back to email: " + email);
                updated = userService.markEmailVerifiedByEmail(email);
            }
        } else {
            // Non-Firebase user: mark by email
            updated = userService.markEmailVerifiedByEmail(email);
        }

        return ResponseEntity.ok(Map.of(
                "message", "Email verified successfully",
                "user", updated != null ? updated : Map.of()));
    }



    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildOtpEmailHtml(String name, String otp) {
        return """
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
                  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h1 style="color: #10b981; margin: 0; font-size: 28px;">PlayMate</h1>
                      <p style="color: #6b7280; margin-top: 4px; font-size: 14px;">Sports Meetup Platform</p>
                    </div>
                    <h2 style="color: #111827; font-size: 20px;">Hi %s,</h2>
                    <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                      Use the verification code below to verify your email address. This code expires in <strong>5 minutes</strong>.
                    </p>
                    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; border: 2px dashed #10b981;">
                      <span style="font-size: 40px; font-weight: 700; color: #10b981; letter-spacing: 8px;">%s</span>
                    </div>
                    <p style="color: #6b7280; font-size: 13px;">
                      If you didn't request this, please ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                      © PlayMate — Find your game, find your team.
                    </p>
                  </div>
                </body>
                </html>
                """.formatted(name, otp);
    }
}
