package com.playmate.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.dto.RatingRequest;
import com.playmate.entity.Rating;
import com.playmate.service.RatingService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ratings")
public class RatingController {

    @Autowired
    private RatingService ratingService;

    @PostMapping
    public ResponseEntity<Rating> createRating(
            @RequestParam Long raterId,
            @Valid @RequestBody RatingRequest request) {
        Rating rating = ratingService.createRating(raterId, request);
        return ResponseEntity.ok(rating);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Rating>> getUserRatings(@PathVariable Long userId) {
        return ResponseEntity.ok(ratingService.getRatingsForUser(userId));
    }

    /** Ratings where user was rated as a HOST (by participants who joined their games) */
    @GetMapping("/user/{userId}/as-host")
    public ResponseEntity<List<Rating>> getHostRatings(@PathVariable Long userId) {
        return ResponseEntity.ok(ratingService.getHostRatingsForUser(userId));
    }

    /** Ratings where user was rated as a PARTICIPANT/JOINER (by the game host) */
    @GetMapping("/user/{userId}/as-participant")
    public ResponseEntity<List<Rating>> getParticipantRatings(@PathVariable Long userId) {
        return ResponseEntity.ok(ratingService.getParticipantRatingsForUser(userId));
    }
}
