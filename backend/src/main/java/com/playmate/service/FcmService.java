package com.playmate.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service for sending Firebase Cloud Messaging (FCM) push notifications.
 * Relies on FirebaseConfig having initialized FirebaseApp.
 */
@Service
public class FcmService {

    /**
     * Send a push notification to a specific device token.
     *
     * @param deviceToken FCM device token stored on the User entity
     * @param title       Notification title
     * @param body        Notification body text
     * @param data        Optional key-value data payload
     */
    public void sendToDevice(String deviceToken, String title, String body, Map<String, String> data) {
        if (deviceToken == null || deviceToken.isBlank()) {
            return; // No device token — silently skip
        }
        if (FirebaseApp.getApps().isEmpty()) {
            System.err.println("[FcmService] Firebase not initialized — push notification skipped.");
            return;
        }

        try {
            Message.Builder messageBuilder = Message.builder()
                    .setToken(deviceToken)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder()
                                    .setSound("default")
                                    .build())
                            .build())
                    .setApnsConfig(ApnsConfig.builder()
                            .setAps(Aps.builder()
                                    .setSound("default")
                                    .setBadge(1)
                                    .build())
                            .build())
                    .setWebpushConfig(WebpushConfig.builder()
                            .setNotification(WebpushNotification.builder()
                                    .setTitle(title)
                                    .setBody(body)
                                    .setIcon("/icons/icon-192x192.png")
                                    .setBadge("/icons/icon-72x72.png")
                                    .build())
                            .build());

            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            String messageId = FirebaseMessaging.getInstance().send(messageBuilder.build());
            System.out.println("[FcmService] Message sent: " + messageId);
        } catch (FirebaseMessagingException e) {
            System.err.println("[FcmService] Failed to send FCM message: " + e.getMessage());
        }
    }

    // ── Convenience helpers for each notification type ────────────────────────

    /** Notify game host that a player joined their game. */
    public void notifyGameJoined(String hostToken, String playerName, String sportType, Long gameId) {
        sendToDevice(hostToken,
                "New Player Joined! 🎮",
                playerName + " joined your " + sportType + " game",
                Map.of("type", "GAME_JOINED", "gameId", String.valueOf(gameId)));
    }

    /** Notify player their join request was accepted. */
    public void notifyGameAccepted(String playerToken, String sportType, Long gameId) {
        sendToDevice(playerToken,
                "You're In! ✅",
                "Your request to join the " + sportType + " game has been accepted",
                Map.of("type", "GAME_ACCEPTED", "gameId", String.valueOf(gameId)));
    }

    /** Notify player their join request was rejected. */
    public void notifyGameRejected(String playerToken, String sportType, Long gameId) {
        sendToDevice(playerToken,
                "Request Declined",
                "Your request to join the " + sportType + " game was not accepted",
                Map.of("type", "GAME_REJECTED", "gameId", String.valueOf(gameId)));
    }

    /** Notify all participants that a game was cancelled. */
    public void notifyGameCancelled(String participantToken, String sportType, Long gameId) {
        sendToDevice(participantToken,
                "Game Cancelled ❌",
                "The " + sportType + " game you joined has been cancelled",
                Map.of("type", "GAME_CANCELLED", "gameId", String.valueOf(gameId)));
    }

    /** Send a reminder 1 hour before the game starts. */
    public void notifyGameReminder(String token, String sportType, String location, Long gameId) {
        sendToDevice(token,
                "Game Reminder ⏰",
                "Your " + sportType + " game at " + location + " starts in 1 hour!",
                Map.of("type", "GAME_REMINDER", "gameId", String.valueOf(gameId)));
    }

    /** Notify player about a nearby game matching their sports. */
    public void notifyNearbyGame(String token, String sportType, String city) {
        sendToDevice(token,
                "Game Nearby! 📍",
                "New " + sportType + " game available in " + city + ". Join now!",
                Map.of("type", "GAME_NEARBY"));
    }

    /** Notify player they have a new message. */
    public void notifyNewMessage(String token, String senderName, String preview) {
        sendToDevice(token,
                "New Message from " + senderName,
                preview.length() > 60 ? preview.substring(0, 57) + "..." : preview,
                Map.of("type", "NEW_MESSAGE"));
    }

    /** Welcome notification after email verification. */
    public void notifyVerified(String token, String userName) {
        sendToDevice(token,
                "Account Verified ✅",
                "Welcome, " + userName + "! Your PlayMate account is now verified.",
                Map.of("type", "ACCOUNT_VERIFIED"));
    }
}
