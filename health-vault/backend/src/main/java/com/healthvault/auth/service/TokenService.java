package com.healthvault.auth.service;

import com.healthvault.auth.config.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;
    private final JwtProperties jwtProperties;
    private final StringRedisTemplate redisTemplate;

    private static final String BLACKLIST_PREFIX = "blacklist:jti:";

    /** Generate a signed JWT access token. The jti (JWT ID) is used for blacklisting on logout. */
    public String generateAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(jwtProperties.accessTokenTtlMinutes() * 60);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())
                .claim("email", email)
                .id(UUID.randomUUID().toString())   // jti — unique per token, used for blacklist key
                .issuedAt(now)
                .expiresAt(expiry)
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Decode and validate a JWT. Throws JwtException if invalid/expired. */
    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }

    /** Generate a cryptographically random 32-byte opaque refresh token, hex-encoded (64 chars). */
    public String generateRefreshTokenRaw() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /** SHA-256 hash of a raw token, hex-encoded. Never stored raw in DB. */
    public String hashToken(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /**
     * Add a JWT's jti to the Redis blacklist with TTL = remaining token lifetime.
     * If Redis is unavailable, logs a warning but does NOT fail the request — the
     * refresh token is still revoked in DB, so the overall logout remains effective.
     */
    public void blacklist(Jwt jwt) {
        String jti = jwt.getId();
        if (jti == null) return;

        long ttlSeconds = Math.max(0, jwt.getExpiresAt().getEpochSecond() - Instant.now().getEpochSecond());
        if (ttlSeconds <= 0) return;   // already expired, nothing to blacklist

        try {
            redisTemplate.opsForValue().set(BLACKLIST_PREFIX + jti, "1", ttlSeconds, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Fail open: refresh token is already revoked in DB.
            // Log but don't break the logout response.
        }
    }

    /**
     * Returns true if the JWT's jti is present in the Redis blacklist.
     * Fails open (returns false) if Redis is unavailable — logged but not propagated.
     */
    public boolean isBlacklisted(Jwt jwt) {
        String jti = jwt.getId();
        if (jti == null) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
        } catch (Exception e) {
            return false;  // fail open
        }
    }
}
