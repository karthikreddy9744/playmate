package com.playmate.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.playmate.entity.Rating;

public interface RatingRepository extends JpaRepository<Rating, Long> {
  List<Rating> findByRateeId(Long userId);

  /** Ratings where user is rated AS a host (received from participants) */
  List<Rating> findByRateeIdAndRatingType(Long userId, Rating.RatingType ratingType);

  boolean existsByRaterIdAndRateeIdAndGameId(Long raterId, Long rateeId, Long gameId);

  Optional<Rating> findByRaterIdAndRateeIdAndGameId(Long raterId, Long rateeId, Long gameId);

  List<Rating> findByIsHiddenTrue();

  boolean existsByRaterIdAndGameId(Long raterId, Long gameId);
}
