package com.playmate.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "games", indexes = {
    @Index(name = "idx_games_sport", columnList = "sport_type"),
    @Index(name = "idx_games_city", columnList = "location_city"),
    @Index(name = "idx_games_datetime", columnList = "game_datetime"),
    @Index(name = "idx_games_created_by", columnList = "created_by"),
    @Index(name = "idx_games_created_at", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Game {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    @NotBlank(message = "Game title is required")
    @Size(min = 5, max = 100, message = "Title must be between 5 and 100 characters")
    private String title;
    
    @Column(length = 1000)
    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    private String description;
    
    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private SportType sportType;
    
    @Column(name = "skill_level")
    @Enumerated(EnumType.STRING)
    private SkillLevel skillLevel;
    
    @Column(name = "max_players")
    @Min(value = 2, message = "Minimum 2 players required")
    @Max(value = 50, message = "Maximum 50 players allowed")
    private Integer maxPlayers;
    
    @Column(name = "current_players")
    private Integer currentPlayers = 0;
    
    @Column(name = "game_datetime", nullable = false)
    private LocalDateTime gameDateTime;
    
    @Column(name = "duration_minutes")
    @Min(value = 20, message = "Minimum game duration is 20 minutes")
    @Max(value = 360, message = "Maximum game duration is 6 hours")
    private Integer durationMinutes = 60;
    
    @Column(name = "location_lat", precision = 10, scale = 8, nullable = false)
    private BigDecimal locationLat;
    
    @Column(name = "location_lng", precision = 11, scale = 8, nullable = false)
    private BigDecimal locationLng;
    
    @Column(name = "location_address", length = 500)
    private String locationAddress;
    
    @Column(name = "location_city", length = 100, nullable = false)
    private String locationCity;
    
    @Column(name = "is_public")
    private Boolean isPublic = true;
    
    @Column(name = "is_cancelled")
    private Boolean isCancelled = false;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    public enum GameStatus {
        OPEN, CANCELLED, COMPLETED, ARCHIVED
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private GameStatus status = GameStatus.OPEN;
    
    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    /** Read-only FK relationship to User — enforces referential integrity at DB level */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", insertable = false, updatable = false)
    private User creator;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @Column(name = "price_per_player", precision = 10, scale = 2)
    private BigDecimal pricePerPlayer = BigDecimal.ZERO;
    
    @Column(name = "equipment_provided")
    private Boolean equipmentProvided = false;
    
    @Column(name = "equipment_details", length = 500)
    private String equipmentDetails;
    
    @Column(name = "rating_required")
    private Boolean ratingRequired = false;
    
    @Column(name = "min_rating", precision = 3, scale = 2)
    private BigDecimal minRating = BigDecimal.ZERO;

    @JsonIgnore
    @ManyToMany
    @JoinTable(
        name = "game_participants",
        joinColumns = @JoinColumn(name = "game_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> participants = new HashSet<>();
    

}