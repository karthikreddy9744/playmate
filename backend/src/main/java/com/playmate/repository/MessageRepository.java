package com.playmate.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.playmate.entity.Message;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    /** All messages in a conversation between two users, ordered by time */
    @Query("SELECT m FROM Message m WHERE " +
           "(m.sender.id = :userId1 AND m.receiver.id = :userId2) OR " +
           "(m.sender.id = :userId2 AND m.receiver.id = :userId1) " +
           "ORDER BY m.createdAt ASC")
    List<Message> findConversation(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    /** DM-only conversation between two users (excludes group messages) */
    @Query("SELECT m FROM Message m WHERE m.gameId IS NULL AND (" +
           "(m.sender.id = :userId1 AND m.receiver.id = :userId2) OR " +
           "(m.sender.id = :userId2 AND m.receiver.id = :userId1)) " +
           "ORDER BY m.createdAt ASC")
    List<Message> findDmConversation(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    /** All conversations for a user — latest message per conversation partner */
    @Query("""
           SELECT m FROM Message m
           WHERE m.id IN (
               SELECT MAX(m2.id) FROM Message m2
               WHERE m2.sender.id = :userId OR m2.receiver.id = :userId
               GROUP BY CASE
                   WHEN m2.sender.id = :userId THEN m2.receiver.id
                   ELSE m2.sender.id
               END
           )
           ORDER BY m.createdAt DESC
           """)
    List<Message> findConversationSummaries(@Param("userId") Long userId);

    /** DM-only inbox summaries (excludes group messages) */
    @Query("""
           SELECT m FROM Message m
           WHERE m.gameId IS NULL AND m.id IN (
               SELECT MAX(m2.id) FROM Message m2
               WHERE m2.gameId IS NULL AND (m2.sender.id = :userId OR m2.receiver.id = :userId)
               GROUP BY CASE
                   WHEN m2.sender.id = :userId THEN m2.receiver.id
                   ELSE m2.sender.id
               END
           )
           ORDER BY m.createdAt DESC
           """)
    List<Message> findDmConversationSummaries(@Param("userId") Long userId);

    /** Unread messages sent TO this user */
    List<Message> findByReceiverIdAndIsReadFalseOrderByCreatedAtDesc(Long receiverId);

    /** Count unread messages for a user */
    long countByReceiverIdAndIsReadFalse(Long receiverId);

    /** Count unread DM messages for a user (excludes group) */
    long countByReceiverIdAndGameIdIsNullAndIsReadFalse(Long receiverId);

    /** Count unread DMs from a specific sender */
    long countByReceiverIdAndSenderIdAndGameIdIsNullAndIsReadFalse(Long receiverId, Long senderId);

    /** Messages in a specific game context */
    List<Message> findByGameIdOrderByCreatedAtAsc(Long gameId);

    /** Delete all messages for a specific game (used by cleanup job) */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM Message m WHERE m.gameId = :gameId")
    void deleteByGameId(@Param("gameId") Long gameId);

    /** Delete DMs (gameId IS NULL) between any pair of users in the given set */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM Message m WHERE m.gameId IS NULL " +
           "AND m.sender.id IN :userIds AND m.receiver.id IN :userIds")
    void deleteDmsBetweenUsers(@Param("userIds") java.util.Collection<Long> userIds);

    /** Delete DMs (gameId IS NULL) between two specific users */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM Message m WHERE m.gameId IS NULL AND (" +
           "(m.sender.id = :u1 AND m.receiver.id = :u2) OR " +
           "(m.sender.id = :u2 AND m.receiver.id = :u1))")
    void deleteDmsBetweenTwoUsers(@Param("u1") Long u1, @Param("u2") Long u2);
}
