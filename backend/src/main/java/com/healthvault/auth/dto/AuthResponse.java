package com.healthvault.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn   // seconds until access token expires
) {}
