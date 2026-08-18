package com.healthvault.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Fixed-window rate limit settings for auth endpoints. */
@ConfigurationProperties(prefix = "rate-limit.auth")
public record RateLimitProperties(
        int maxRequests,
        int windowSeconds
) {}
