package com.playmate.service;

import java.util.Collections;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import brevo.ApiClient;
import brevo.ApiException;
import brevo.Configuration;
import brevo.auth.ApiKeyAuth;
import brevoApi.TransactionalEmailsApi;
import brevoModel.SendSmtpEmail;
import brevoModel.SendSmtpEmailSender;
import brevoModel.SendSmtpEmailTo;

@Service
public class EmailService {

    @Value("${brevo.api.key}")
    private String brevoApiKey;

    public void sendEmail(String to, String subject, String content) {
        ApiClient defaultClient = Configuration.getDefaultApiClient();
        ApiKeyAuth apiKey = (ApiKeyAuth) defaultClient.getAuthentication("api-key");
        apiKey.setApiKey(brevoApiKey);

        TransactionalEmailsApi api = new TransactionalEmailsApi();
        SendSmtpEmailSender sender = new SendSmtpEmailSender();
        sender.setEmail("noreply@playmate.com"); // Placeholder: Replace with your sender email
        sender.setName("PlayMate"); // Placeholder: Replace with your sender name

        SendSmtpEmailTo receiver = new SendSmtpEmailTo();
        receiver.setEmail(to);

        SendSmtpEmail sendSmtpEmail = new SendSmtpEmail();
        sendSmtpEmail.setSender(sender);
        sendSmtpEmail.setTo(Collections.singletonList(receiver));
        sendSmtpEmail.setSubject(subject);
        sendSmtpEmail.setHtmlContent(content);

        try {
            api.sendTransacEmail(sendSmtpEmail);
        } catch (ApiException e) {
            throw new RuntimeException("Failed to send email to " + to, e);
        }
    }
}
