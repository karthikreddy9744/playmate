package com.playmate.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateGameRequest {
    private String title;
    private String description;

    @NotBlank(message = "Sport is required")
    private String sport;

    private String skillLevel;

    @NotNull(message = "Start time is required")
    private String startTime;

    @Min(value = 20, message = "Minimum 20 minutes")
    @jakarta.validation.constraints.Max(value = 360, message = "Maximum game duration is 6 hours")
    private Integer durationMinutes = 60;

    @Min(value = 2, message = "Minimum 2 players")
    private Integer totalSlots;

    /** How many players are already confirmed (including the creator). Defaults to 1 in service. */
    @Min(value = 1, message = "At least 1 (you)")
    private Integer alreadyConfirmed;
    
    private Integer availableSlots;

    private BigDecimal costPerPerson;

    private BigDecimal locationLat;
    private BigDecimal locationLng;
    private String locationAddress;
    private String locationCity;
    private String notes;
    private Boolean equipmentProvided;
    private String equipmentDetails;
    private Boolean isPublic;
    private Boolean ratingRequired;
    private BigDecimal minRating;
}
