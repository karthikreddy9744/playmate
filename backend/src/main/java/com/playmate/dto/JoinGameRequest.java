package com.playmate.dto;

import lombok.Data;

@Data
public class JoinGameRequest {
    private String firebaseUid;
    private String message;
}
