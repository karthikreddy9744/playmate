package com.playmate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class PlaymateApplication {
  public static void main(String[] args) {
    SpringApplication.run(PlaymateApplication.class, args);
  }
}
