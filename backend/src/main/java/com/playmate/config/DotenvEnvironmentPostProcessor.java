package com.playmate.config;

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
        Dotenv dotenv = Dotenv.configure()
                .directory("/Users/thalakolakarthikreddy/playmate/") // Specify the directory where .env is located
                .load();

        Map<String, Object> dotenvMap = new HashMap<>();
        dotenv.entries().forEach(entry -> {
                    String key = entry.getKey();
                    String value = entry.getValue();
                    dotenvMap.put(key, value); // Keep original for direct access if needed

                    // Convert to Spring-friendly dot.case
                    String springKey = key.toLowerCase().replace("_", ".");
                    dotenvMap.put(springKey, value);
                });

        System.out.println("Loaded .env variables via EnvironmentPostProcessor: " + dotenvMap);
        System.out.println("Cloudinary Cloud Name in dotenvMap: " + dotenvMap.get("cloudinary.cloud.name"));

        environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", dotenvMap));
    }
}
