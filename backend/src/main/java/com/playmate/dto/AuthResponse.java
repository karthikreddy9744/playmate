package com.playmate.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String refreshToken;
    private Long userId;
    private String email;
    private String name;
    private String role;
    private Boolean verifiedEmail;
    private String firebaseUid;
}
