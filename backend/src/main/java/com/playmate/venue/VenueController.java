package com.playmate.venue;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;

@RestController
@RequestMapping("/api/venues")
public class VenueController {
  @Autowired
  private VenueRepository venueRepository;

  @PostMapping
  public ResponseEntity<Venue> create(@RequestBody Venue venue) {
    Venue saved = venueRepository.save(venue);
    return ResponseEntity.ok(saved);
  }

  @GetMapping
  public ResponseEntity<List<Venue>> list() {
    return ResponseEntity.ok(venueRepository.findAll());
  }
}
