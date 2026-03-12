package com.playmate.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 255)
    private String firebaseUid;
    
    @Column(nullable = false, unique = true, length = 255)
    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    private String email;
    

    
    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 255)
    @NotBlank(message = "Password is required")
    private String passwordHash;
    
    @Column(nullable = false, length = 100)
    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;
    
    @Column
    @Min(value = 18, message = "Must be at least 18 years old")
    private Integer age;
    
    @Column
    @Enumerated(EnumType.STRING)
    private Gender gender;
    
    @Column(length = 200)
    @Size(max = 200, message = "Bio cannot exceed 200 characters")
    private String bio;
    
    @Column(name = "profile_picture_url", length = 500)
    private String profilePictureUrl;
    
    @Column(name = "location_lat", precision = 10, scale = 8)
    private BigDecimal locationLat;
    
    @Column(name = "location_lng", precision = 11, scale = 8)
    private BigDecimal locationLng;
    
    @Column(name = "location_city", length = 100)
    private String locationCity;

    @Column(name = "location_address", length = 300)
    private String locationAddress;

    @Column(name = "phone", length = 20)
    private String phone;
    


    @Column(name = "verified_email")
    private Boolean verifiedEmail = false;
    
    @Column(name = "verified_id")
    private Boolean verifiedId = false;

    /** Firebase Cloud Messaging device token — used for push notifications */
    @JsonIgnore
    @Column(name = "fcm_token", length = 512)
    private String fcmToken;

    /** User preference: mute all web push notifications */
    @Column(name = "notifications_muted")
    private Boolean notificationsMuted = false;
    
    @Column(name = "total_games_played")
    private Integer totalGamesPlayed = 0;
    
    @Column(name = "average_rating", precision = 3, scale = 2)
    private BigDecimal averageRating = BigDecimal.ZERO;
    
    @Column(name = "no_show_count")
    private Integer noShowCount = 0;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "role", length = 20)
    private String role = "user";

    @Column(name = "is_active")
    private Boolean isActive = true;
    
    public enum Gender {
        MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
    }


    @JsonIgnore
    @ManyToMany(mappedBy = "participants")
    private Set<Game> games = new HashSet<>();

    // Only use id for equals/hashCode to ensure JPA set logic works for participants
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return id != null && id.equals(user.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

}