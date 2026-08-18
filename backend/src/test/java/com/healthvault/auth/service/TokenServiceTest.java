package com.healthvault.auth.service;

import com.healthvault.auth.config.JwtProperties;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private TokenService tokenService;

    private static final String TEST_SECRET = "test-secret-key-for-unit-tests-only!!";

    @BeforeEach
    void setUp() {
        byte[] keyBytes = TEST_SECRET.getBytes(StandardCharsets.UTF_8);
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");

        OctetSequenceKey jwk = new OctetSequenceKey.Builder(key.getEncoded())
                .algorithm(JWSAlgorithm.HS256)
                .build();
        JwtEncoder encoder = new NimbusJwtEncoder(new ImmutableJWKSet<SecurityContext>(new JWKSet(jwk)));
        JwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();

        JwtProperties props = new JwtProperties(TEST_SECRET, 15L, 30L);
        tokenService = new TokenService(encoder, decoder, props, redisTemplate);
    }

    @Test
    void generateAccessToken_produces_valid_jwt_with_expected_claims() {
        UUID userId = UUID.randomUUID();
        String email = "alice@example.com";

        String token = tokenService.generateAccessToken(userId, email);

        assertThat(token).isNotBlank();
        Jwt jwt = tokenService.decode(token);
        assertThat(jwt.getSubject()).isEqualTo(userId.toString());
        assertThat(jwt.getClaimAsString("email")).isEqualTo(email);
        assertThat(jwt.getId()).isNotBlank();          // jti must be present for blacklisting
        assertThat(jwt.getExpiresAt()).isNotNull();
    }

    @Test
    void generateRefreshTokenRaw_returns_64char_lowercase_hex() {
        String raw = tokenService.generateRefreshTokenRaw();
        assertThat(raw).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void generateRefreshTokenRaw_produces_unique_values() {
        String first  = tokenService.generateRefreshTokenRaw();
        String second = tokenService.generateRefreshTokenRaw();
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void hashToken_is_deterministic() {
        String input = "some-raw-refresh-token";
        assertThat(tokenService.hashToken(input)).isEqualTo(tokenService.hashToken(input));
    }

    @Test
    void hashToken_different_inputs_produce_different_hashes() {
        assertThat(tokenService.hashToken("aaa")).isNotEqualTo(tokenService.hashToken("bbb"));
    }

    @Test
    void isBlacklisted_returns_false_when_jti_not_in_redis() {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        UUID userId = UUID.randomUUID();
        Jwt jwt = tokenService.decode(tokenService.generateAccessToken(userId, "test@test.com"));
        assertThat(tokenService.isBlacklisted(jwt)).isFalse();
    }

    @Test
    void isBlacklisted_returns_true_when_jti_present_in_redis() {
        when(redisTemplate.hasKey(anyString())).thenReturn(true);
        UUID userId = UUID.randomUUID();
        Jwt jwt = tokenService.decode(tokenService.generateAccessToken(userId, "test@test.com"));
        assertThat(tokenService.isBlacklisted(jwt)).isTrue();
    }

    @Test
    void blacklist_writes_jti_to_redis_with_ttl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        UUID userId = UUID.randomUUID();
        Jwt jwt = tokenService.decode(tokenService.generateAccessToken(userId, "test@test.com"));
        tokenService.blacklist(jwt);
        verify(valueOps).set(startsWith("blacklist:jti:"), eq("1"), anyLong(), any());
    }
}
