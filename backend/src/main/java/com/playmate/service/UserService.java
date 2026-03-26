package com.playmate.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.dto.RegisterRequest;
import com.playmate.dto.UserResponse;
import com.playmate.dto.UserUpdateRequest;
import com.playmate.entity.SkillLevel;
import com.playmate.entity.User;
import com.playmate.entity.UserSport;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.UserRepository;
import com.playmate.repository.UserSportRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserSportRepository userSportRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

public UserResponse createUser(RegisterRequest request) {
        // Check if email already exists
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setName(resolveName(request.getName(), request.getEmail()));
        user.setEmail(request.getEmail());

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirebaseUid(request.getFirebaseUid() != null ? request.getFirebaseUid() : "fb_" + System.currentTimeMillis());
        user.setRole("user");
        user.setCreatedAt(LocalDateTime.now());
        
        // Normal registration requires email verification via OTP
        // Only Firebase/Google sign-in users are auto-verified (handled in AuthController)
        user.setVerifiedEmail(false);
        user.setVerifiedId(false);
        
        if (request.getProfilePictureUrl() != null) user.setProfilePictureUrl(request.getProfilePictureUrl());

        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    /**
     * Create a user with auto-verified email (for Firebase/Google sign-in)
     * Google already verifies email addresses, so these users can be trusted
     */
    public UserResponse createFirebaseUser(RegisterRequest request) {
        // Check if email already exists
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setName(resolveName(request.getName(), request.getEmail()));
        user.setEmail(request.getEmail());

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirebaseUid(request.getFirebaseUid() != null ? request.getFirebaseUid() : "fb_" + System.currentTimeMillis());
        user.setRole("user");
        user.setCreatedAt(LocalDateTime.now());
        
        // Firebase/Google users are auto-verified since Google verifies emails
        user.setVerifiedEmail(true);
        user.setVerifiedId(true);
        
        if (request.getProfilePictureUrl() != null) user.setProfilePictureUrl(request.getProfilePictureUrl());

        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));
        return toUserResponse(user);
    }

    public UserResponse getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
        return toUserResponse(user);
    }

    public UserResponse getUserByFirebaseUid(String firebaseUid) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
            .orElseThrow(() -> new UserNotFoundException("User not found with firebase UID: " + firebaseUid));
        // Auto-fix: if verified_email is true but verified_id is false, set verified_id true
        if (Boolean.TRUE.equals(user.getVerifiedEmail()) && !Boolean.TRUE.equals(user.getVerifiedId())) {
            user.setVerifiedId(true);
            userRepository.saveAndFlush(user);
        }
        return toUserResponse(user);
    }

    public Optional<User> findOptionalUserByFirebaseUid(String firebaseUid) {
        return userRepository.findByFirebaseUid(firebaseUid);
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));

        if (request.getName() != null) user.setName(request.getName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());

        if (request.getAge() != null) user.setAge(request.getAge());
        if (request.getGender() != null) {
            try {
                user.setGender(User.Gender.valueOf(request.getGender().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getProfilePictureUrl() != null) user.setProfilePictureUrl(request.getProfilePictureUrl());
        if (request.getLocationCity() != null) user.setLocationCity(request.getLocationCity());
        // Role changes are not allowed via user self-update

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    public void updateLastLogin(Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());
    }

    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User not found with id: " + id);
        }
        userRepository.deleteById(id);
    }

    // User Sports Management
    public List<UserSport> getUserSports(Long userId) {
        return userSportRepository.findByUserId(userId);
    }

    @Transactional
    public UserSport addUserSport(Long userId, String sport, SkillLevel skillLevel) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        Optional<UserSport> existing = userSportRepository.findByUserIdAndSport(userId, sport);
        if (existing.isPresent()) {
            // Update skill level if sport already exists
            UserSport userSport = existing.get();
            userSport.setSkillLevel(skillLevel);
            return userSportRepository.save(userSport);
        }

        UserSport userSport = new UserSport();
        userSport.setUser(user);
        userSport.setSport(sport);
        userSport.setSkillLevel(skillLevel);
        return userSportRepository.save(userSport);
    }

    @Transactional
    public void removeUserSport(Long userId, String sport) {
        userSportRepository.deleteByUserIdAndSport(userId, sport);
    }

    @Transactional
    public void updateFcmToken(String firebaseUid, String fcmToken) {
        userRepository.findByFirebaseUid(firebaseUid).ifPresent(user -> {
            user.setFcmToken(fcmToken);
            userRepository.save(user);
        });
    }

    @Transactional
    public UserResponse markEmailVerified(String firebaseUid) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
            .orElseThrow(() -> new UserNotFoundException("User not found"));

        // Already fully verified — skip DB write
        if (Boolean.TRUE.equals(user.getVerifiedEmail()) && Boolean.TRUE.equals(user.getVerifiedId())) {
            return toUserResponse(user);
        }

        // Ensure both flags are true and persist
        user.setVerifiedEmail(true);
        user.setVerifiedId(true);
        userRepository.saveAndFlush(user);
        return toUserResponse(user);
    }

    /**
     * Mark email as verified for a user identified by email (non-Firebase flows).
     */
    @Transactional
    public UserResponse markEmailVerifiedByEmail(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));

        if (Boolean.TRUE.equals(user.getVerifiedEmail())) {
            if (!Boolean.TRUE.equals(user.getVerifiedId())) {
                user.setVerifiedId(true);
                userRepository.saveAndFlush(user);
            }
            return toUserResponse(user);
        }

        user.setVerifiedEmail(true);
        user.setVerifiedId(true);
        userRepository.saveAndFlush(user);
        return toUserResponse(user);
    }



    @Transactional
    public UserResponse updateProfilePicture(String firebaseUid, String photoUrl) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        user.setProfilePictureUrl(photoUrl);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateUserByFirebaseUid(String firebaseUid, com.playmate.dto.UserProfileUpdateRequest request) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> new UserNotFoundException("User not found with firebase UID: " + firebaseUid));

        if (request.getName() != null) user.setName(resolveName(request.getName(), user.getEmail()));
        if (request.getAge() != null) user.setAge(request.getAge());
        if (request.getGender() != null) {
            try {
                user.setGender(User.Gender.valueOf(request.getGender().toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getProfilePictureUrl() != null) user.setProfilePictureUrl(request.getProfilePictureUrl());
        if (request.getLocationCity() != null) user.setLocationCity(request.getLocationCity());
        if (request.getLocationAddress() != null) user.setLocationAddress(request.getLocationAddress());
        if (request.getLocationLat() != null) {
            user.setLocationLat(BigDecimal.valueOf(request.getLocationLat()));
        }
        if (request.getLocationLng() != null) {
            user.setLocationLng(BigDecimal.valueOf(request.getLocationLng()));
        }

        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);

        // Sync sports: add/update incoming, remove those not present
        if (request.getSports() != null) {
            List<UserSport> existing = userSportRepository.findByUserId(saved.getId());
            Set<String> incomingNames = new HashSet<>();
            for (com.playmate.dto.UserProfileUpdateRequest.SportItem item : request.getSports()) {
                if (item.getSportType() == null) continue;
                String sportName = item.getSportType();
                incomingNames.add(sportName);
                Optional<UserSport> match = existing.stream()
                        .filter(us -> sportName.equals(us.getSport()))
                        .findFirst();
                try {
                    com.playmate.entity.SkillLevel level = item.getSkillLevel() != null
                            ? com.playmate.entity.SkillLevel.valueOf(item.getSkillLevel().toUpperCase())
                            : com.playmate.entity.SkillLevel.BEGINNER;

                    if (match.isPresent()) {
                        UserSport us = match.get();
                        us.setSkillLevel(level);
                        userSportRepository.save(us);
                    } else {
                        addUserSport(saved.getId(), sportName, level);
                    }
                } catch (IllegalArgumentException ignored) {
                    // invalid skill level string; skip
                }
            }

            // remove sports that are not in the incoming list
            for (UserSport us : existing) {
                if (!incomingNames.contains(us.getSport())) {
                    removeUserSport(saved.getId(), us.getSport());
                }
            }
        }

        return toUserResponse(userRepository.findById(saved.getId()).orElse(saved));
    }

    public UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setFirebaseUid(user.getFirebaseUid());
        response.setEmail(user.getEmail());

        response.setName(user.getName());
        response.setAge(user.getAge());
        response.setGender(user.getGender() != null ? user.getGender().name() : null);
        response.setBio(user.getBio());
        response.setProfilePictureUrl(user.getProfilePictureUrl());
        response.setLocationLat(user.getLocationLat());
        response.setLocationLng(user.getLocationLng());
        response.setLocationCity(user.getLocationCity());
        response.setLocationAddress(user.getLocationAddress());
        response.setPhone(user.getPhone());
        response.setVerifiedEmail(user.getVerifiedEmail());
        response.setVerifiedId(user.getVerifiedId());
        response.setTotalGamesPlayed(user.getTotalGamesPlayed());
        response.setAverageRating(user.getAverageRating());
        response.setNoShowCount(user.getNoShowCount());
        response.setGamesCreated(user.getGamesCreated());
        response.setGamesCancelled(user.getGamesCancelled());
        response.setLastMinuteCancellations(user.getLastMinuteCancellations());
        response.setHostReliabilityScore(user.getHostReliabilityScore());
        response.setPlayAgainPercentage(user.getPlayAgainPercentage());
        response.setRole(user.getRole());
        response.setIsActive(user.getIsActive());
        response.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);
        response.setLastLogin(user.getLastLogin() != null ? user.getLastLogin().toString() : null);
        return response;
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
}
