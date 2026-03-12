package com.playmate.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * AES-256-GCM authenticated encryption for message content at rest.
 *
 * <h3>Algorithm: AES-256-GCM</h3>
 * <ul>
 *   <li>256-bit key derived from the environment variable {@code PLAYMATE_MSG_ENCRYPTION_KEY}</li>
 *   <li>96-bit random IV (Initialization Vector) per message — prepended to ciphertext</li>
 *   <li>128-bit authentication tag (GCM default) — guarantees integrity + authenticity</li>
 * </ul>
 *
 * <h3>Storage format (Base64)</h3>
 * <pre>[12-byte IV][ciphertext + 16-byte auth tag]</pre>
 *
 * Every call to {@link #encrypt(String)} generates a fresh random IV,
 * so identical plaintext produces different ciphertext each time.
 */
@Service
public class MessageEncryptionService {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;   // 96 bits — NIST recommended
    private static final int GCM_TAG_LENGTH = 128;  // bits
    private static final String KEY_ALGORITHM = "AES";

    private final SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public MessageEncryptionService(
            @Value("${playmate.msg.encryption-key}") String base64Key) {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        if (keyBytes.length != 32) {
            throw new IllegalArgumentException(
                    "PLAYMATE_MSG_ENCRYPTION_KEY must be exactly 32 bytes (256 bits) after Base64 decoding. Got " + keyBytes.length);
        }
        this.secretKey = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
    }

    /**
     * Encrypt plaintext message content.
     *
     * @param plaintext the raw message content
     * @return Base64-encoded string: {@code IV + ciphertext + authTag}
     */
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Prepend IV to ciphertext
            ByteBuffer buf = ByteBuffer.allocate(GCM_IV_LENGTH + ciphertext.length);
            buf.put(iv);
            buf.put(ciphertext);

            return Base64.getEncoder().encodeToString(buf.array());
        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException
                 | InvalidAlgorithmParameterException | IllegalBlockSizeException | BadPaddingException e) {
            throw new RuntimeException("Message encryption failed", e);
        }
    }

    /**
     * Decrypt a previously encrypted message.
     *
     * @param encryptedBase64 Base64-encoded string produced by {@link #encrypt(String)}
     * @return the original plaintext
     */
    public String decrypt(String encryptedBase64) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedBase64);
            ByteBuffer buf = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[GCM_IV_LENGTH];
            buf.get(iv);
            byte[] ciphertext = new byte[buf.remaining()];
            buf.get(ciphertext);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(ciphertext);

            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException
                 | InvalidAlgorithmParameterException | IllegalBlockSizeException | BadPaddingException e) {
            // If decryption fails, return the raw content (handles pre-encryption legacy messages)
            return encryptedBase64;
        }
    }

    /**
     * Check if a string looks like it was encrypted (valid Base64 and long enough to contain IV + tag).
     */
    public boolean isEncrypted(String content) {
        if (content == null || content.length() < 40) return false; // min: 12-byte IV + 16-byte tag = 28 bytes → ~40 chars Base64
        try {
            byte[] decoded = Base64.getDecoder().decode(content);
            return decoded.length >= GCM_IV_LENGTH + 16; // IV + at least auth tag
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
