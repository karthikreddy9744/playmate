package com.playmate.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.playmate.dto.MessageResponse;
import com.playmate.entity.Game;
import com.playmate.entity.Message;
import com.playmate.entity.User;
import com.playmate.exception.EmailNotVerifiedException;
import com.playmate.exception.GameNotFoundException;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.GameRepository;
import com.playmate.repository.MessageRepository;
import com.playmate.repository.UserRepository;

@Service
public class MessageService {

    @Autowired private MessageRepository messageRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private GameRepository gameRepository;
    @Autowired private FcmService fcmService;
    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private MessageEncryptionService encryptionService;

    /**
     * Send a direct message from one user to another.
     * gameId is always null for DMs – DMs are independent of game lifecycle.
     * Triggers FCM push + WebSocket broadcast.
     */
    @Transactional
    public MessageResponse sendMessage(Long senderId, Long receiverId, String content, Long gameId) {
        User sender   = userRepository.findById(senderId)
                .orElseThrow(() -> new UserNotFoundException("Sender not found"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new UserNotFoundException("Receiver not found"));

        if (!Boolean.TRUE.equals(sender.getVerifiedEmail())) {
            throw new EmailNotVerifiedException("Email must be verified to send messages.");
        }

        // Block DMs between users who don't share any active game
        boolean shared = shareActiveGame(senderId, receiverId, null);
        if (!shared) {
            throw new IllegalStateException("You can only message players from an active game.");
        }

        Message message = new Message();
        message.setSender(sender);
        message.setReceiver(receiver);
        message.setContent(encryptionService.encrypt(content));
        message.setGameId(null); // DMs are game-independent
        message.setCreatedAt(LocalDateTime.now());

        Message saved = messageRepository.save(message);

        // Push notification to receiver via FCM (if available)
        if (receiver.getFcmToken() != null && !receiver.getFcmToken().isBlank()) {
            fcmService.notifyNewMessage(receiver.getFcmToken(), sender.getName(),
                    content.length() > 60 ? content.substring(0, 57) + "..." : content);
        }

        // Publish message to WebSocket subscribers for real-time in-app chat
        try {
            MessageResponse resp = toResponse(saved);
            // Send to receiver-specific queue and a conversation topic
            messagingTemplate.convertAndSendToUser(String.valueOf(receiver.getId()), "/queue/messages", resp);
            messagingTemplate.convertAndSend("/topic/conversation/" + Math.min(sender.getId(), receiver.getId()) + "-" + Math.max(sender.getId(), receiver.getId()), resp);
        } catch (RuntimeException e) {
            // Do not fail the request if WebSocket delivery fails
            // log at debug to avoid noisy logs in production
            try {
                // use messagingTemplate's logger if available, fallback to stderr
                System.err.println("[MessageService] WebSocket publish failed: " + e.getMessage());
            } catch (Exception ignore) { }
        }

        return toResponse(saved);
    }

    /** Get DM-only conversation thread between two users (excludes group messages). */
    public List<MessageResponse> getConversation(Long userId1, Long userId2) {
        return messageRepository.findDmConversation(userId1, userId2)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * Get conversation summaries for the inbox.
     * Returns a list of maps with otherUserId, otherUserName, otherUserPhoto,
     * otherUserVerified, lastMessage, lastMessageTime, unreadCount — matching
     * the frontend InboxEntry interface exactly.
     */
    public List<Map<String, Object>> getInbox(Long userId) {
        List<Message> summaries = messageRepository.findDmConversationSummaries(userId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Message m : summaries) {
            boolean isSender = m.getSender().getId().equals(userId);
            User other = isSender ? m.getReceiver() : m.getSender();

            long unread = messageRepository.countByReceiverIdAndSenderIdAndGameIdIsNullAndIsReadFalse(userId, other.getId());

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("otherUserId",       other.getId());
            entry.put("otherUserName",     other.getName() != null ? other.getName() : "Unknown");
            entry.put("otherUserPhoto",    other.getProfilePictureUrl());
            entry.put("otherUserVerified", Boolean.TRUE.equals(other.getVerifiedEmail()));
            entry.put("lastMessage",       encryptionService.decrypt(m.getContent()));
            entry.put("lastMessageTime",   m.getCreatedAt() != null ? m.getCreatedAt().toString() : "");
            entry.put("unreadCount",       unread);
            result.add(entry);
        }
        return result;
    }

    /** Mark all DM messages from a sender as read by the receiver. */
    @Transactional
    public void markConversationRead(Long receiverId, Long senderId) {
        List<Message> unread = messageRepository.findDmConversation(senderId, receiverId)
                .stream()
                .filter(m -> m.getReceiver().getId().equals(receiverId) && !Boolean.TRUE.equals(m.getIsRead()))
                .collect(Collectors.toList());
        unread.forEach(m -> {
            m.setIsRead(true);
            m.setReadAt(LocalDateTime.now());
        });
        messageRepository.saveAll(unread);
    }

    /** Count of unread DM messages for a user (group unreads handled separately). */
    public long getUnreadCount(Long userId) {
        return messageRepository.countByReceiverIdAndGameIdIsNullAndIsReadFalse(userId);
    }

    // ── Group messaging (game-level chat) ────────────────────────────────────

    /**
     * Send a message to the game group chat.
     * A group message is stored once per recipient (all participants except sender).
     */
    @Transactional
    public List<MessageResponse> sendGroupMessage(Long gameId, Long senderId, String content) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found"));
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new UserNotFoundException("Sender not found"));

        if (!Boolean.TRUE.equals(sender.getVerifiedEmail())) {
            throw new EmailNotVerifiedException("Email must be verified to send messages.");
        }

        // Block if game ended or cancelled
        if (Boolean.TRUE.equals(game.getIsCancelled())) {
            throw new IllegalStateException("Group chat disabled: the game was cancelled.");
        }
        if (game.getGameDateTime() != null) {
            long durationMins = game.getDurationMinutes() != null ? game.getDurationMinutes().longValue() : 60;
            LocalDateTime gameEnd = game.getGameDateTime().plusMinutes(durationMins).plusMinutes(30);
            if (LocalDateTime.now().isAfter(gameEnd)) {
                throw new IllegalStateException("Group chat disabled: the game has ended.");
            }
        }

        // Sender must be a participant or the game creator
        boolean senderIsCreator = game.getCreatedBy().equals(senderId);
        boolean senderIsParticipant = game.getParticipants().stream()
                .anyMatch(u -> u.getId().equals(sender.getId()));
        if (!senderIsCreator && !senderIsParticipant) {
            throw new IllegalStateException("Only accepted game participants can use group chat.");
        }

        // Build full recipient set: all participants + creator (excluding sender)
        Set<User> allMembers = new LinkedHashSet<>(game.getParticipants());
        if (!senderIsParticipant && senderIsCreator) {
            // Creator not in participants set (legacy data) — they're still a member
        }
        // Ensure game creator is in the recipient pool
        if (game.getCreator() != null && allMembers.stream().noneMatch(u -> u.getId().equals(game.getCreatedBy()))) {
            allMembers.add(game.getCreator());
        }

        // Send to every other member — use one timestamp + one ciphertext for the whole batch
        // so dedup (senderId + second + decryptedContent) always matches
        List<MessageResponse> sent = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        String encrypted = encryptionService.encrypt(content);
        for (User recipient : allMembers) {
            if (recipient.getId().equals(senderId)) continue;

            Message msg = new Message();
            msg.setSender(sender);
            msg.setReceiver(recipient);
            msg.setContent(encrypted);
            msg.setGameId(gameId);
            msg.setCreatedAt(now);
            Message saved = messageRepository.save(msg);
            sent.add(toResponse(saved));

            // FCM push (fire-and-forget)
            if (recipient.getFcmToken() != null && !recipient.getFcmToken().isBlank()) {
                fcmService.notifyNewMessage(recipient.getFcmToken(),
                        sender.getName() + " (Group)",
                        content.length() > 60 ? content.substring(0, 57) + "..." : content);
            }
        }

        // WebSocket broadcast to the game group topic
        try {
            if (!sent.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/game-group/" + gameId, sent.get(0));
            }
        } catch (RuntimeException e) {
            System.err.println("[MessageService] Group WS publish failed: " + e.getMessage());
        }

        return sent;
    }

    /**
     * Get group messages for a game — deduplicated.
     * Because each group message is stored once per recipient, we deduplicate
     * by (senderId + content + createdAt second) to show one bubble per message.
     */
    public List<MessageResponse> getGameGroupMessages(Long gameId) {
        List<Message> all = messageRepository.findByGameIdOrderByCreatedAtAsc(gameId);
        Set<String> seen = new LinkedHashSet<>();
        List<Message> deduped = new ArrayList<>();
        for (Message m : all) {
            String key = m.getSender().getId() + "|" + (m.getCreatedAt() != null ? m.getCreatedAt().withNano(0) : "") + "|" + encryptionService.decrypt(m.getContent());
            if (seen.add(key)) {
                deduped.add(m);
            }
        }
        return deduped.stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** Get participants of a game (for group chat member list), always includes the creator. */
    public List<Map<String, Object>> getGameChatMembers(Long gameId) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> new GameNotFoundException("Game not found"));
        Set<User> allMembers = new LinkedHashSet<>(game.getParticipants());
        // Ensure the game creator is always listed
        if (game.getCreator() != null && allMembers.stream().noneMatch(u -> u.getId().equals(game.getCreatedBy()))) {
            allMembers.add(game.getCreator());
        }
        return allMembers.stream()
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("profilePictureUrl", u.getProfilePictureUrl());
                    return m;
                })
                .collect(Collectors.toList());
    }

    /**
     * Send an auto welcome DM from host to accepted user.
     * Called by GameRequestService after acceptance — bypasses email-verification check.
     */
    @Transactional
    public void sendAutoWelcomeDm(Long hostId, Long acceptedUserId, String gameTitle) {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new UserNotFoundException("Host not found"));
        User accepted = userRepository.findById(acceptedUserId)
                .orElseThrow(() -> new UserNotFoundException("Accepted user not found"));

        String content = "Welcome! Your request to join \"" + gameTitle + "\" has been accepted. Let's chat! \uD83C\uDFAE";

        Message message = new Message();
        message.setSender(host);
        message.setReceiver(accepted);
        message.setContent(encryptionService.encrypt(content));
        message.setGameId(null); // DM, not group
        message.setCreatedAt(LocalDateTime.now());
        Message saved = messageRepository.save(message);

        // Push notification
        if (accepted.getFcmToken() != null && !accepted.getFcmToken().isBlank()) {
            fcmService.notifyNewMessage(accepted.getFcmToken(), host.getName(), content);
        }

        // WebSocket
        try {
            MessageResponse resp = toResponse(saved);
            messagingTemplate.convertAndSendToUser(String.valueOf(accepted.getId()), "/queue/messages", resp);
            messagingTemplate.convertAndSend("/topic/conversation/" + Math.min(host.getId(), accepted.getId()) + "-" + Math.max(host.getId(), accepted.getId()), resp);
        } catch (RuntimeException e) {
            System.err.println("[MessageService] Auto-welcome WS publish failed: " + e.getMessage());
        }
    }

    private MessageResponse toResponse(Message m) {
        MessageResponse r = new MessageResponse();
        r.setId(m.getId());
        r.setSenderId(m.getSender().getId());
        r.setSenderName(m.getSender().getName());
        r.setSenderPhotoUrl(m.getSender().getProfilePictureUrl());
        r.setReceiverId(m.getReceiver().getId());
        r.setReceiverName(m.getReceiver().getName());
        r.setReceiverPhotoUrl(m.getReceiver().getProfilePictureUrl());
        r.setGameId(m.getGameId());
        r.setContent(encryptionService.decrypt(m.getContent()));
        r.setIsRead(m.getIsRead());
        r.setCreatedAt(m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);
        r.setReadAt(m.getReadAt() != null ? m.getReadAt().toString() : null);
        return r;
    }

    /**
     * Get "contacts" for the Direct tab: all users that share an active game with this user.
     * For a game CREATOR  → returns all accepted participants (excluding self).
     * For a PARTICIPANT   → returns the game creator + other accepted participants.
     * Deduplicated across games.
     */
    public List<Map<String, Object>> getContacts(Long userId) {
        List<Game> activeGames = getActiveGames();
        // Collect unique co-participants from active games only
        Map<Long, User> contacts = new LinkedHashMap<>();
        for (Game g : activeGames) {
            boolean userInGame = g.getCreatedBy().equals(userId)
                    || (g.getParticipants() != null && g.getParticipants().stream().anyMatch(u -> u.getId().equals(userId)));
            if (!userInGame) continue;
            // Add all other participants
            if (g.getParticipants() != null) {
                for (User u : g.getParticipants()) {
                    if (!u.getId().equals(userId)) contacts.putIfAbsent(u.getId(), u);
                }
            }
            // Also add the game creator if the current user is a participant (not the creator)
            if (!g.getCreatedBy().equals(userId) && g.getCreator() != null) {
                contacts.putIfAbsent(g.getCreatedBy(), g.getCreator());
            }
        }
        return contacts.values().stream()
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("otherUserId",       u.getId());
                    m.put("otherUserName",     u.getName() != null ? u.getName() : "Unknown");
                    m.put("otherUserPhoto",    u.getProfilePictureUrl());
                    m.put("otherUserVerified", Boolean.TRUE.equals(u.getVerifiedEmail()));
                    return m;
                })
                .collect(Collectors.toList());
    }

    // ── Privacy cleanup ──────────────────────────────────────────────────────

    /** Check whether a game is still active (not cancelled and not yet ended). */
    private boolean isGameActive(Game g) {
        if (Boolean.TRUE.equals(g.getIsCancelled())) return false;
        if (g.getGameDateTime() == null) return true;
        long durMins = g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60;
        LocalDateTime gameEnd = g.getGameDateTime().plusMinutes(durMins).plusMinutes(30);
        return !LocalDateTime.now().isAfter(gameEnd);
    }

    /** Return all games that are not cancelled and have not yet ended. */
    private List<Game> getActiveGames() {
        return gameRepository.findByIsCancelledFalse().stream()
                .filter(this::isGameActive)
                .collect(Collectors.toList());
    }

    /** Check if two users share at least one active game (excluding a specific game). */
    public boolean shareActiveGame(Long userId1, Long userId2, Long excludeGameId) {
        for (Game g : getActiveGames()) {
            if (excludeGameId != null && g.getId().equals(excludeGameId)) continue;
            Set<Long> memberIds = new java.util.HashSet<>();
            if (g.getCreatedBy() != null) memberIds.add(g.getCreatedBy());
            if (g.getParticipants() != null) g.getParticipants().forEach(u -> memberIds.add(u.getId()));
            if (memberIds.contains(userId1) && memberIds.contains(userId2)) return true;
        }
        return false;
    }

    /**
     * Purge all messages related to a game:
     * 1. Delete all group messages (gameId = given game)
     * 2. Delete DMs between participant pairs who do NOT share another active game
     */
    @Transactional
    public void purgeGameMessages(Long gameId) {
        Game game = gameRepository.findById(gameId).orElse(null);
        if (game == null) return;

        // 1. Delete group messages
        messageRepository.deleteByGameId(gameId);

        // 2. Collect all member IDs
        Set<Long> memberIds = new java.util.HashSet<>();
        if (game.getCreatedBy() != null) memberIds.add(game.getCreatedBy());
        if (game.getParticipants() != null) game.getParticipants().forEach(u -> memberIds.add(u.getId()));

        // For each pair, delete DMs only if they don't share another active game
        List<Long> members = new ArrayList<>(memberIds);
        for (int i = 0; i < members.size(); i++) {
            for (int j = i + 1; j < members.size(); j++) {
                Long a = members.get(i);
                Long b = members.get(j);
                if (!shareActiveGame(a, b, gameId)) {
                    messageRepository.deleteDmsBetweenUsers(java.util.Set.of(a, b));
                }
            }
        }
    }
}
