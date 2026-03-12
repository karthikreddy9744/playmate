package com.playmate.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.playmate.entity.Rating;

public interface RatingRepository extends JpaRepository<Rating, Long> {
  List<Rating> findByRateeId(Long userId);

  /** Ratings where user is rated AS a host (received from participants) */
  List<Rating> findByRateeIdAndRatingType(Long userId, Rating.RatingType ratingType);
}
