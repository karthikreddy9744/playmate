package com.playmate.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.playmate.entity.UserSport;

@Repository
public interface UserSportRepository extends JpaRepository<UserSport, Long> {
    List<UserSport> findByUserId(Long userId);
    Optional<UserSport> findByUserIdAndSport(Long userId, String sport);
    void deleteByUserIdAndSport(Long userId, String sport);
}
