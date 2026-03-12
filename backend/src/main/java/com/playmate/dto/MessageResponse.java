package com.playmate.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class MessageResponse {
    private Long id;
    private Long senderId;
    private String senderName;
    private String senderPhotoUrl;
    private Long receiverId;
    private String receiverName;
    private String receiverPhotoUrl;
    private Long gameId;
    private String content;
    private Boolean isRead;
    private String createdAt;
    private String readAt;
}
