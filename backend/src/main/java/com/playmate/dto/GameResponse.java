package com.playmate.dto;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameResponse {
    private Long id;
    private String title;
    private String description;
    private String sport;
    private String skillLevel;
    private String startTime;
    private Integer durationMinutes;
    private Integer totalSlots;
    private Integer availableSlots;
    private BigDecimal costPerPerson;
    private BigDecimal locationLat;
    private BigDecimal locationLng;
    private String locationAddress;
    private String locationCity;
    private String notes;
    private Boolean equipmentProvided;
    private String equipmentDetails;
    private Long createdBy;
    private String createdByName;
    private String createdAt;
    private String updatedAt;
    private Boolean isCancelled;
    private Integer participantCount;
    /** IDs of participants, used by frontend to check if current user participated */
    private java.util.List<Long> participantIds;
    /** Computed status: UPCOMING | LIVE | COMPLETED | CANCELLED | FULL */
    private String status;
    /** Distance from the searching user in km (populated when lat/lng provided) */
    private Double distanceKm;
    /** Whether the CURRENTLY LOGGED IN user has already rated this game */
    private Boolean hasRated;
}
