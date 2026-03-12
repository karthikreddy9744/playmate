package com.playmate.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RatingRequest {
    @NotNull(message = "Game ID is required")
    private Long gameId;

    @NotNull(message = "Ratee ID is required")
    private Long rateeId;

    @Min(1) @Max(5)
    @NotNull(message = "Punctuality rating is required")
    private Integer punctuality;

    @Min(1) @Max(5)
    @NotNull(message = "Skill match rating is required")
    private Integer skillMatch;

    @Min(1) @Max(5)
    @NotNull(message = "Friendliness rating is required")
    private Integer friendliness;

    @Size(max = 500)
    private String reviewText;
}
