package com.playmate.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.playmate.dto.MessageResponse;

/**
 * Simple pass-through controller for messages sent from clients to /app/chat
 * Currently messages are stored via REST endpoints; this controller can be
 * used by clients to broadcast typing indicators or draft messages.
 */
@Controller
public class WebsocketMessageController {

    @MessageMapping("/chat/typing")
    @SendTo("/topic/typing")
    public String typing(@Payload String payload) {
        return payload;
    }

    @MessageMapping("/chat/message")
    @SendTo("/topic/chat")
    public MessageResponse incoming(MessageResponse msg) {
        // This is a lightweight echo path; real persistence happens via REST API.
        return msg;
    }
}
