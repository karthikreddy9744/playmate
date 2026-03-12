package com.playmate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@EnableScheduling
@SpringBootApplication
public class PlaymateApplication {

  @PostConstruct
  public void init() {
    // Force the JVM to use Asia/Kolkata (IST) globally
    TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
  }

  public static void main(String[] args) {
    SpringApplication.run(PlaymateApplication.class, args);
  }
}
