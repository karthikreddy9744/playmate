package com.playmate.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.playmate.dto.UserResponse;
import com.playmate.dto.UserUpdateRequest;
import com.playmate.entity.SkillLevel;
import com.playmate.entity.User;
import com.playmate.entity.UserSport;
import com.playmate.repository.UserRepository;
import com.playmate.service.CloudinaryService;
import com.playmate.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {
  @Autowired private UserService userService;
  @Autowired private CloudinaryService cloudinaryService;
  @Autowired private UserRepository userRepository;

  @GetMapping("/{id}")
  public ResponseEntity<UserResponse> get(@PathVariable Long id) {
    return ResponseEntity.ok(userService.getUserById(id));
  }

  @PutMapping("/{id}")
  public ResponseEntity<UserResponse> update(@PathVariable Long id, @RequestBody UserUpdateRequest request) {
    return ResponseEntity.ok(userService.updateUser(id, request));
  }

  @GetMapping("/firebase/{firebaseUid}")
  public ResponseEntity<UserResponse> getByFirebaseUid(@PathVariable String firebaseUid) {
    return ResponseEntity.ok(userService.getUserByFirebaseUid(firebaseUid));
  }

  @PutMapping("/firebase/{firebaseUid}")
  public ResponseEntity<UserResponse> updateUserByFirebaseUid(
      @PathVariable String firebaseUid,
      @RequestBody com.playmate.dto.UserProfileUpdateRequest request) {
    // Authorization: allow if requester is the same firebase UID or has ADMIN role
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return ResponseEntity.status(401).build();
    }

    String requesterEmail = auth.getName();
    User requester = userRepository.findByEmail(requesterEmail).orElse(null);
    boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN") || a.getAuthority().equalsIgnoreCase("ADMIN"));

    if (requester == null && !isAdmin) {
      return ResponseEntity.status(403).build();
    }

    if (!isAdmin) {
      // If not admin, the firebaseUid must match the requester's firebase UID
      if (requester == null || requester.getFirebaseUid() == null || !requester.getFirebaseUid().equals(firebaseUid)) {
        return ResponseEntity.status(403).build();
      }
    }

    return ResponseEntity.ok(userService.updateUserByFirebaseUid(firebaseUid, request));
  }

  @GetMapping("/email/{email}")
  public ResponseEntity<UserResponse> getByEmail(@PathVariable String email) {
    return ResponseEntity.ok(userService.getUserByEmail(email));
  }

  // ── Profile photo upload ────────────────────────────────────────────────────

  /**
   * POST /api/users/firebase/{firebaseUid}/photo
   * Multipart upload — uploads to Cloudinary and saves secure URL to user profile.
   */
  @PostMapping("/firebase/{firebaseUid}/photo")
  public ResponseEntity<?> uploadProfilePhoto(
          @PathVariable String firebaseUid,
          @RequestParam("file") MultipartFile file) {
    try {
      // Validate type
      String contentType = file.getContentType();
      if (contentType == null || !contentType.startsWith("image/")) {
        return ResponseEntity.badRequest().body(Map.of("error", "Only image files are allowed"));
      }

      // Get user ID for folder naming
      UserResponse user = userService.getUserByFirebaseUid(firebaseUid);
      String photoUrl = cloudinaryService.uploadProfilePicture(file, user.getId());
      UserResponse updated = userService.updateProfilePicture(firebaseUid, photoUrl);
      return ResponseEntity.ok(Map.of("photoUrl", photoUrl, "user", updated));
    } catch (IOException e) {
      return ResponseEntity.status(500).body(Map.of("error", "Upload failed: " + e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  // ── User Sports endpoints ───────────────────────────────────────────────────

  @GetMapping("/{userId}/sports")
  public ResponseEntity<List<UserSport>> getUserSports(@PathVariable Long userId) {
    return ResponseEntity.ok(userService.getUserSports(userId));
  }

  @PostMapping("/{userId}/sports")
  public ResponseEntity<UserSport> addUserSport(
          @PathVariable Long userId,
          @RequestBody Map<String, String> request) {
    String sport = request.get("sport");
    SkillLevel skillLevel;
    try {
      skillLevel = SkillLevel.valueOf(request.getOrDefault("skillLevel", "BEGINNER").toUpperCase());
    } catch (IllegalArgumentException e) {
      skillLevel = SkillLevel.BEGINNER;
    }
    return ResponseEntity.ok(userService.addUserSport(userId, sport, skillLevel));
  }

  @DeleteMapping("/{userId}/sports/{sport}")
  public ResponseEntity<Void> removeUserSport(@PathVariable Long userId, @PathVariable String sport) {
    userService.removeUserSport(userId, sport);
    return ResponseEntity.ok().build();
  }
}