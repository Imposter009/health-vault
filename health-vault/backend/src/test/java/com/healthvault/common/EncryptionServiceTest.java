package com.healthvault.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.*;

class EncryptionServiceTest {

    private EncryptionService service;

    @BeforeEach
    void setUp() {
        // 32 bytes (256 bits) encoded as Base64
        byte[] key = new byte[32];
        for (int i = 0; i < 32; i++) key[i] = (byte) i;
        String base64Key = Base64.getEncoder().encodeToString(key);
        service = new EncryptionService(new EncryptionProperties(base64Key));
    }

    @Test
    void roundTrip_shortString() {
        String plaintext = "lab-report-2024.pdf";
        byte[] ciphertext = service.encrypt(plaintext);
        assertThat(service.decrypt(ciphertext)).isEqualTo(plaintext);
    }

    @Test
    void roundTrip_unicodeString() {
        String plaintext = "rapport médical – résultats.pdf";
        byte[] ciphertext = service.encrypt(plaintext);
        assertThat(service.decrypt(ciphertext)).isEqualTo(plaintext);
    }

    @Test
    void sameInputProducesDifferentCiphertext() {
        String plaintext = "prescription.pdf";
        byte[] ct1 = service.encrypt(plaintext);
        byte[] ct2 = service.encrypt(plaintext);
        // Fresh IV each time → ciphertexts must differ
        assertThat(ct1).isNotEqualTo(ct2);
        // But both decrypt correctly
        assertThat(service.decrypt(ct1)).isEqualTo(plaintext);
        assertThat(service.decrypt(ct2)).isEqualTo(plaintext);
    }

    @Test
    void ciphertextContainsIvPrepended() {
        // AES-GCM with 12-byte IV: ciphertext length = 12 (IV) + plaintext.length + 16 (tag)
        String plaintext = "abc";  // 3 bytes UTF-8
        byte[] ct = service.encrypt(plaintext);
        assertThat(ct.length).isEqualTo(12 + 3 + 16);
    }

    @Test
    void wrongKeyThrowsOnConstruction() {
        // 31 bytes — one byte too short
        byte[] shortKey = new byte[31];
        String badBase64 = Base64.getEncoder().encodeToString(shortKey);
        assertThatThrownBy(() -> new EncryptionService(new EncryptionProperties(badBase64)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("32 bytes");
    }

    @Test
    void tamperedCiphertextThrowsOnDecrypt() {
        byte[] ct = service.encrypt("sensitive.pdf");
        ct[ct.length - 1] ^= 0xFF;   // flip last byte (in the GCM auth tag)
        assertThatThrownBy(() -> service.decrypt(ct))
            .isInstanceOf(RuntimeException.class);
    }
}
