package com.healthvault.common;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM encryption for sensitive metadata fields (filenames, extracted text).
 *
 * Format: IV (12 bytes) || GCM ciphertext+tag (variable).
 * A fresh random IV is generated per encryption call — never reused.
 *
 * NOTE: This is a single-key setup suitable for local dev and simple deployments.
 * In production, replace with a KMS-backed solution (AWS KMS, HashiCorp Vault)
 * that supports key rotation and auditing. That is a noted future improvement.
 *
 * The file bytes in MinIO are NOT application-layer encrypted here — this relies on:
 *   - MinIO/S3 server-side encryption at rest (configure via MINIO_SERVER_SIDE_ENCRYPTION
 *     in production; docker-compose uses plaintext for local dev simplicity).
 *   - TLS in transit between clients and MinIO.
 * Field-level encryption here is specifically for sensitive metadata in PostgreSQL.
 */
@Service
public class EncryptionService {

    private static final int IV_BYTES  = 12;  // 96-bit IV for GCM
    private static final int TAG_BITS  = 128; // GCM authentication tag

    private final SecretKey secretKey;

    public EncryptionService(EncryptionProperties props) {
        byte[] keyBytes = Base64.getDecoder().decode(props.documentKey());
        if (keyBytes.length != 32) {
            throw new IllegalStateException(
                "DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits) for AES-256. " +
                "Got " + keyBytes.length + " bytes. Use: openssl rand -base64 32");
        }
        this.secretKey = new SecretKeySpec(keyBytes, "AES");
    }

    public byte[] encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] result = new byte[IV_BYTES + ciphertext.length];
            System.arraycopy(iv,         0, result, 0,        IV_BYTES);
            System.arraycopy(ciphertext, 0, result, IV_BYTES, ciphertext.length);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public String decrypt(byte[] ivAndCiphertext) {
        try {
            byte[] iv         = Arrays.copyOfRange(ivAndCiphertext, 0,        IV_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(ivAndCiphertext, IV_BYTES, ivAndCiphertext.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
