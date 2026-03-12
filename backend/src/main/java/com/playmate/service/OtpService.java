package com.playmate.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.Duration;

/**
 * OTP (One-Time Password) service backed by Redis.
 * OTPs expire after 5 minutes. Only 3 active attempts per key.
 */
@Service
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    private static final Duration OTP_TTL = Duration.ofMinutes(5);
    private static final Duration ATTEMPTS_TTL = Duration.ofMinutes(10);
    private static final int MAX_ATTEMPTS = 5;

    private static final String OTP_PREFIX   = "otp:";
    private static final String ATTEMPTS_PREFIX = "otp_attempts:";

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    private final SecureRandom random = new SecureRandom();

    /** Generate and store a 6-digit OTP for the given identifier (email or phone). */
    public String generateAndStore(String identifier) {
        String otp = "%06d".formatted(random.nextInt(1_000_000));
        String key = OTP_PREFIX + identifier;
        redisTemplate.opsForValue().set(key, otp, OTP_TTL);
        // reset attempt counter on fresh generation
        redisTemplate.delete(ATTEMPTS_PREFIX + identifier);
        logger.info("Generated OTP for {}: {}", identifier, otp);
        return otp;
    }

    /**
     * Verify an OTP.
     * Returns true if correct (and deletes it so it can't be reused).
     * Returns false if wrong, expired, or too many attempts.
     */
    public boolean verify(String identifier, String submittedOtp) {
        logger.info("Verifying OTP for {}: submitted={}", identifier, submittedOtp);
        
        String attemptsKey = ATTEMPTS_PREFIX + identifier;
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;
        
        logger.info("Current attempts for {}: {}", identifier, attempts);

        if (attempts >= MAX_ATTEMPTS) {
            logger.warn("Max attempts exceeded for {}", identifier);
            return false; // locked out
        }

        String key = OTP_PREFIX + identifier;
        String storedOtp = redisTemplate.opsForValue().get(key);
        
        logger.info("Stored OTP for {}: {}", identifier, storedOtp);

        if (storedOtp == null) {
            logger.warn("No OTP found for {} (expired or never sent)", identifier);
            return false; // expired or never sent
        }

        if (!storedOtp.equals(submittedOtp)) {
            // Increment attempt counter
            redisTemplate.opsForValue().increment(attemptsKey);
            redisTemplate.expire(attemptsKey, ATTEMPTS_TTL);
            logger.warn("Invalid OTP for {}: expected={}, submitted={}", identifier, storedOtp, submittedOtp);
            return false;
        }

        // Correct OTP → delete it (single-use)
        redisTemplate.delete(key);
        redisTemplate.delete(attemptsKey);
        logger.info("OTP verified successfully for {}", identifier);
        return true;
    }

    /** Check if an OTP exists (i.e., was recently sent and not yet expired). */
    public boolean isOtpPending(String identifier) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(OTP_PREFIX + identifier));
    }

    /** Remaining TTL in seconds for a pending OTP. */
    public long getTtlSeconds(String identifier) {
        Long ttl = redisTemplate.getExpire(OTP_PREFIX + identifier);
        return ttl != null ? ttl : 0;
    }
}
