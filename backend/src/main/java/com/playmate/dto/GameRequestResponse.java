package com.playmate.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameRequestResponse {
    private Long id;
    private Long gameId;
    private String gameTitle;
    private Long requesterId;
    private String requesterName;
    private String requesterPhotoUrl;
    private String status;
    private String message;
    private String createdAt;
    private String respondedAt;
    
    // Game details for rating logic
    private String gameStartTime;
    private Integer gameDurationMinutes;
    private Boolean hasRated;
    
    // Requester stats for host view
    private Double requesterRating;
    private Integer requesterGamesPlayed;
    private Integer requesterNoShows;
    private Boolean requesterVerified;
}
