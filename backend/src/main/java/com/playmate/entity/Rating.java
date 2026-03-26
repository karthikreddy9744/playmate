package com.playmate.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ratings",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_rating_rater_ratee_game",
        columnNames = {"rater_id", "ratee_id", "game_id"}
    ),
    indexes = {
        @Index(name = "idx_ratings_ratee", columnList = "ratee_id"),
        @Index(name = "idx_ratings_game", columnList = "game_id"),
        @Index(name = "idx_ratings_type", columnList = "rating_type")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Rating {

  /** Whether this rating is about a host (received by creator) or about a participant (received by joiner). */
  public enum RatingType {
    /** Participant rating the host — stored on the host's profile as "Hosting Rating" */
    FOR_HOST,
    /** Host rating a participant — stored on the participant's profile as "Joining Rating" */
    FOR_PARTICIPANT
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "rater_id", nullable = false)
  private User rater;

  @ManyToOne(optional = false)
  @JoinColumn(name = "ratee_id", nullable = false)
  private User ratee;

  @ManyToOne(optional = false)
  @JoinColumn(name = "game_id", nullable = false)
  private Game game;

  @Enumerated(EnumType.STRING)
  @Column(length = 20)
  private RatingType ratingType;

  @Column(nullable = false)
  private Integer punctuality;

  @Column(nullable = false)
  private Integer skillMatch;

  @Column(nullable = false)
  private Integer friendliness;

  @Column(length = 500)
  private String reviewText;

  @Column(name = "play_again")
  private Boolean playAgain;

  /** ONLY for FOR_HOST ratings. Was the game actually played? */
  @Column(name = "was_game_conducted")
  private Boolean wasGameConducted;

  @Column(name = "is_hidden")
  private Boolean isHidden = true;

  @Column(name = "revealed_at")
  private LocalDateTime revealedAt;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt = LocalDateTime.now();
}
