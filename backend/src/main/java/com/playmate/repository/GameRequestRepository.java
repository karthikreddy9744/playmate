package com.playmate.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.playmate.entity.GameRequest;

@Repository
public interface GameRequestRepository extends JpaRepository<GameRequest, Long> {
    List<GameRequest> findByGameId(Long gameId);
    List<GameRequest> findByRequesterId(Long requesterId);
    List<GameRequest> findByGameIdAndStatus(Long gameId, GameRequest.RequestStatus status);
    Optional<GameRequest> findByGameIdAndRequesterId(Long gameId, Long requesterId);
    long countByRequesterIdAndStatus(Long requesterId, GameRequest.RequestStatus status);
    List<GameRequest> findByGameCreatedBy(Long hostUserId);
}
