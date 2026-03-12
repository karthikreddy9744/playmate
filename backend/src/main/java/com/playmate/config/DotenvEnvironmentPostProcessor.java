package com.playmate.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import io.github.cdimascio.dotenv.Dotenv;

public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // Look for .env in the working directory; skip entirely if the file is absent
        // (on Render / cloud, env vars are provided by the platform, not a .env file)
        Path envFile = Paths.get(System.getProperty("user.dir")).resolve(".env");
        if (!Files.exists(envFile)) {
            // Also check one level up (backend/ → project root)
            envFile = Paths.get(System.getProperty("user.dir")).resolve("../.env").normalize();
        }
        if (!Files.exists(envFile)) {
            System.out.println("[DotenvPostProcessor] No .env file found — using platform environment variables.");
            return;
        }

        Dotenv dotenv = Dotenv.configure()
                .directory(envFile.getParent().toString())
                .load();

        Map<String, Object> dotenvMap = new HashMap<>();
        dotenv.entries().forEach(entry -> {
            String key = entry.getKey();
            String value = entry.getValue();
            dotenvMap.put(key, value);

            // Convert to Spring-friendly dot.case
            String springKey = key.toLowerCase().replace("_", ".");
            dotenvMap.put(springKey, value);
        });

        System.out.println("[DotenvPostProcessor] Loaded " + dotenvMap.size() + " properties from .env");
        environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", dotenvMap));
    }
}
