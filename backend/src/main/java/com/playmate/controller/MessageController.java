package com.playmate.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.playmate.dto.MessageResponse;
import com.playmate.service.MessageService;

/**
 * REST API for in-app player-to-player messaging.
 *
 * GET    /api/messages/inbox/{userId}                     — conversations inbox
 * GET    /api/messages/conversation/{userId1}/{userId2}   — full thread
 * POST   /api/messages/send                               — send a message
 * POST   /api/messages/read/{receiverId}/{senderId}       — mark thread as read
 * GET    /api/messages/unread-count/{userId}              — unread badge count
 */
@RestController
@RequestMapping("/api/messages")
public class MessageController {

    @Autowired private MessageService messageService;

    /** Get all conversations for the inbox (latest message per partner). */
    @GetMapping("/inbox/{userId}")
    public ResponseEntity<?> getInbox(@PathVariable Long userId) {
        return ResponseEntity.ok(messageService.getInbox(userId));
    }

    /** Get the full conversation thread between two users. */
    @GetMapping("/conversation/{userId1}/{userId2}")
    public ResponseEntity<List<MessageResponse>> getConversation(
            @PathVariable Long userId1, @PathVariable Long userId2) {
        return ResponseEntity.ok(messageService.getConversation(userId1, userId2));
    }

    /**
     * Send a message.
     * Body: { "senderId": 1, "receiverId": 2, "content": "...", "gameId": 5 (optional) }
     */
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, Object> body) {
        try {
            Long senderId   = Long.valueOf(String.valueOf(body.get("senderId")));
            Long receiverId = Long.valueOf(String.valueOf(body.get("receiverId")));
            String content  = (String) body.get("content");
            Long   gameId   = body.get("gameId") != null ? Long.valueOf(String.valueOf(body.get("gameId"))) : null;

            if (content == null || content.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message content cannot be empty"));
            }
            if (content.length() > 2000) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message cannot exceed 2000 characters"));
            }

            MessageResponse sent = messageService.sendMessage(senderId, receiverId, content.trim(), gameId);
            return ResponseEntity.ok(sent);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid ID format: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Mark all messages from a sender as read by the receiver. */
    @PostMapping("/read/{receiverId}/{senderId}")
    public ResponseEntity<?> markRead(@PathVariable Long receiverId, @PathVariable Long senderId) {
        messageService.markConversationRead(receiverId, senderId);
        return ResponseEntity.ok(Map.of("message", "Marked as read"));
    }

    /** Get the unread message count for the badge. */
    @GetMapping("/unread-count/{userId}")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("count", messageService.getUnreadCount(userId)));
    }

    /** Get contacts: all game co-participants for the Direct tab. */
    @GetMapping("/contacts/{userId}")
    public ResponseEntity<?> getContacts(@PathVariable Long userId) {
        return ResponseEntity.ok(messageService.getContacts(userId));
    }

    // ── Group chat endpoints ─────────────────────────────────────────────────

    /** Get all messages in a game group chat. */
    @GetMapping("/group/{gameId}")
    public ResponseEntity<List<MessageResponse>> getGroupMessages(@PathVariable Long gameId) {
        return ResponseEntity.ok(messageService.getGameGroupMessages(gameId));
    }

    /** Send a message to the game group chat. */
    @PostMapping("/group/{gameId}/send")
    public ResponseEntity<?> sendGroupMessage(@PathVariable Long gameId, @RequestBody Map<String, Object> body) {
        try {
            Long senderId = Long.valueOf(String.valueOf(body.get("senderId")));
            String content = (String) body.get("content");
            if (content == null || content.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message content cannot be empty"));
            }
            List<MessageResponse> sent = messageService.sendGroupMessage(gameId, senderId, content.trim());
            return ResponseEntity.ok(sent);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid ID format: " + e.getMessage()));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Get participant list for a game group chat. */
    @GetMapping("/group/{gameId}/members")
    public ResponseEntity<List<Map<String, Object>>> getGroupMembers(@PathVariable Long gameId) {
        return ResponseEntity.ok(messageService.getGameChatMembers(gameId));
    }
}
