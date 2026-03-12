package com.playmate.config;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import jakarta.annotation.PostConstruct;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initializeFirebase() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return; // Already initialized
        }

        try {
            // Priority 1: Environment variable (for Render / cloud deployments)
            String credentialsJson = System.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
            if (credentialsJson != null && !credentialsJson.isBlank()) {
                InputStream stream = new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8));
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(stream))
                        .build();
                FirebaseApp.initializeApp(options);
                System.out.println("[FirebaseConfig] Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS_JSON env var.");
                return;
            }

            // Priority 2: Classpath file (local development)
            ClassPathResource resource = new ClassPathResource("firebase-service-account.json");
            if (resource.exists()) {
                InputStream serviceAccount = resource.getInputStream();
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();
                FirebaseApp.initializeApp(options);
                System.out.println("[FirebaseConfig] Firebase Admin SDK initialized from service account file.");
            } else {
                // Priority 3: Application default credentials (GCP / CI)
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.getApplicationDefault())
                        .build();
                FirebaseApp.initializeApp(options);
                System.out.println("[FirebaseConfig] Firebase Admin SDK initialized via application default credentials.");
            }
        } catch (IOException e) {
            System.err.println("[FirebaseConfig] WARNING: Firebase Admin SDK NOT initialized: " + e.getMessage());
            System.err.println("[FirebaseConfig] Set GOOGLE_APPLICATION_CREDENTIALS_JSON env var or place firebase-service-account.json in src/main/resources/.");
        }
    }
}
