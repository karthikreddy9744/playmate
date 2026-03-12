package com.playmate.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.redis.core.RedisTemplate;
import java.util.Map;
import java.util.HashMap;

/**
 * Debug controller for development only.
 * Provides endpoints to help debug OTP issues.
 * Remove or secure this in production.
 */
@RestController
@RequestMapping("/api/debug")
public class DebugController {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    /**
     * GET /api/debug/otp/{email}
     * Returns the current OTP for the given email (for debugging only)
     */
    @GetMapping("/otp/{email}")
    public ResponseEntity<?> getOtp(@PathVariable String email) {
        String otpKey = "otp:" + email;
        String attemptsKey = "otp_attempts:" + email;
        
        String otp = redisTemplate.opsForValue().get(otpKey);
        String attempts = redisTemplate.opsForValue().get(attemptsKey);
        Long ttl = redisTemplate.getExpire(otpKey);
        
        Map<String, Object> response = new HashMap<>();
        response.put("email", email);
        response.put("otp", otp);
        response.put("attempts", attempts != null ? attempts : "0");
        response.put("ttl_seconds", ttl != null ? ttl : -1);
        response.put("exists", otp != null);
        
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/debug/all-otps
     * Returns all current OTPs (for debugging only)
     */
    @GetMapping("/all-otps")
    public ResponseEntity<?> getAllOtps() {
        Map<String, Object> response = new HashMap<>();
        
        // Get all OTP keys
        var otpKeys = redisTemplate.keys("otp:*");
        if (otpKeys != null) {
            for (String key : otpKeys) {
                String value = redisTemplate.opsForValue().get(key);
                Long ttl = redisTemplate.getExpire(key);
                response.put(key, Map.of("otp", value, "ttl_seconds", ttl));
            }
        }
        
        // Get all attempts keys
        var attemptsKeys = redisTemplate.keys("otp_attempts:*");
        if (attemptsKeys != null) {
            for (String key : attemptsKeys) {
                String value = redisTemplate.opsForValue().get(key);
                Long ttl = redisTemplate.getExpire(key);
                response.put(key, Map.of("attempts", value, "ttl_seconds", ttl));
            }
        }
        
        return ResponseEntity.ok(response);
    }
}
