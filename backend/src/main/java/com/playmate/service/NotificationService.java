package com.playmate.service;

import com.playmate.entity.Notification;
import com.playmate.entity.User;
import com.playmate.repository.NotificationRepository;
import com.playmate.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FcmService fcmService;

    /**
     * Create an in-app DB notification AND send a FCM push to the user's device.
     */
    public Notification createNotification(Long userId, Notification.NotificationType type,
                                           String title, String message, Long referenceId, String referenceType) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return null;

        // --- Persist in-app notification ---
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notification.setReferenceType(referenceType);
        notification.setCreatedAt(LocalDateTime.now());

        Notification saved = notificationRepository.save(notification);

        // --- Send FCM push (skip if user muted notifications) ---
        if (Boolean.TRUE.equals(user.getNotificationsMuted())) {
            return saved; // In-app notification saved, but no push
        }
        String fcmToken = user.getFcmToken();
        if (fcmToken != null && !fcmToken.isBlank()) {
            Map<String, String> data = Map.of(
                    "type", type.name(),
                    "referenceId", referenceId != null ? String.valueOf(referenceId) : "",
                    "referenceType", referenceType != null ? referenceType : ""
            );
            fcmService.sendToDevice(fcmToken, title, message, data);
        }

        return saved;
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getUnreadNotifications(Long userId) {
        return notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.setIsRead(true);
            notificationRepository.save(notification);
        });
    }

    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
    }
}

