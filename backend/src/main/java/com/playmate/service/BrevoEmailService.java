package com.playmate.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;

@Service
public class BrevoEmailService {
    
    private static final Logger logger = LoggerFactory.getLogger(BrevoEmailService.class);
    
    @Value("${brevo.api.key}")
    private String brevoApiKey;
    
    @Value("${brevo.sender.email:noreply@playmate.com}")
    private String senderEmail;
    
    @Value("${brevo.sender.name:PlayMate}")
    private String senderName;
    
    private final RestTemplate restTemplate = new RestTemplate();
    
    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
    
    public boolean sendEmail(String toEmail, String toName, String subject, String htmlContent) {
        try {
            logger.info("Sending email to {} via Brevo", toEmail);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", brevoApiKey);
            
            Map<String, Object> sender = new HashMap<>();
            sender.put("email", senderEmail);
            sender.put("name", senderName);
            
            Map<String, Object> to = new HashMap<>();
            to.put("email", toEmail);
            to.put("name", toName);
            
            Map<String, Object> emailRequest = new HashMap<>();
            emailRequest.put("sender", sender);
            emailRequest.put("to", Collections.singletonList(to));
            emailRequest.put("subject", subject);
            emailRequest.put("htmlContent", htmlContent);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(emailRequest, headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                BREVO_API_URL, HttpMethod.POST, entity, String.class);
            
            logger.info("Brevo API response status: {}", response.getStatusCode());
            logger.info("Brevo API response body: {}", response.getBody());
            
            boolean success = response.getStatusCode() == HttpStatus.OK || 
                   response.getStatusCode() == HttpStatus.CREATED;
            
            if (success) {
                logger.info("Email sent successfully to {}", toEmail);
            } else {
                logger.warn("Failed to send email to {}. Status: {}", toEmail, response.getStatusCode());
            }
            
            return success;
            
        } catch (org.springframework.web.client.RestClientException e) {
            logger.error("Failed to send email via Brevo to {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }
    
    public boolean sendWelcomeEmail(String toEmail, String toName) {
        String subject = "Welcome to PlayMate!";
        String htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f4f4f4; padding: 10px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to PlayMate!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello %s!</h2>
                        <p>Welcome to PlayMate - your platform to find sports partners and games near you!</p>
                        <p>Get ready to:</p>
                        <ul>
                            <li>Discover games in your area</li>
                            <li>Connect with fellow sports enthusiasts</li>
                            <li>Join or create games easily</li>
                            <li>Build your sports community</li>
                        </ul>
                        <p>Start exploring games now and never play alone again!</p>
                    </div>
                    <div class="footer">
                        <p>Happy Playing!<br>The PlayMate Team</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(toName);
        
        return sendEmail(toEmail, toName, subject, htmlContent);
    }
    
    public boolean sendGameInvitationEmail(String toEmail, String toName, String gameTitle, 
                                         String gameDate, String location) {
        String subject = "You're invited to a game: " + gameTitle;
        String htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .game-details { background: #f9f9f9; padding: 15px; border-radius: 5px; }
                    .footer { background: #f4f4f4; padding: 10px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Game Invitation!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello %s!</h2>
                        <p>You've been invited to join a game:</p>
                        <div class="game-details">
                            <h3>%s</h3>
                            <p><strong>Date & Time:</strong> %s</p>
                            <p><strong>Location:</strong> %s</p>
                        </div>
                        <p>Log in to your PlayMate account to accept the invitation and see more details!</p>
                    </div>
                    <div class="footer">
                        <p>See you on the field!<br>The PlayMate Team</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(toName, gameTitle, gameDate, location);
        
        return sendEmail(toEmail, toName, subject, htmlContent);
    }
}