package com.playmate.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.playmate.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    long countByCreatedAtAfter(LocalDateTime dateTime);
    long countByLastLoginAfter(LocalDateTime dateTime);
    Optional<User> findByEmail(String email);
    default Optional<User> findByEmailOptional(String email) { return findByEmail(email); }
    Optional<User> findByFirebaseUid(String firebaseUid);
    long countByVerifiedEmailTrue();
}
