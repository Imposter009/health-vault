package com.healthvault.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration — values come from environment variables.
 * secret must be at least 32 characters (256 bits) for HS256.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        long accessTokenTtlMinutes,
        long refreshTokenTtlDays
) {}
