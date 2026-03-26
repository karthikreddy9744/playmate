package com.playmate.dto;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String firebaseUid;
    private String email;
    private String name;
    private Integer age;
    private String gender;
    private String bio;
    private String profilePictureUrl;
    private BigDecimal locationLat;
    private BigDecimal locationLng;
    private String locationCity;
    private String locationAddress;
    private String phone;
    private Boolean verifiedEmail;
    private Boolean verifiedId;
    private Integer totalGamesPlayed;
    private BigDecimal averageRating;
    private Integer noShowCount;
    private Integer gamesCreated;
    private Integer gamesCancelled;
    private Integer lastMinuteCancellations;
    private BigDecimal hostReliabilityScore;
    private BigDecimal playAgainPercentage;
    private String role;
    private Boolean isActive;
    private String createdAt;
    private String lastLogin;
}
