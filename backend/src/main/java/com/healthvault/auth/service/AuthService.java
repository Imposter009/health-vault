package com.healthvault.auth.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.service.AuditService;
import com.healthvault.auth.config.JwtProperties;
import com.healthvault.auth.dto.AuthResponse;
import com.healthvault.auth.dto.LoginRequest;
import com.healthvault.auth.dto.RegisterRequest;
import com.healthvault.auth.dto.UserResponse;
import com.healthvault.auth.entity.RefreshToken;
import com.healthvault.auth.entity.User;
import com.healthvault.auth.repository.RefreshTokenRepository;
import com.healthvault.auth.repository.UserRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenService tokenService;
    private final PasswordEncoder passwordEncoder;
    private final JwtProperties jwtProperties;
    private final AuditService auditService;
    private final MeterRegistry meterRegistry;

    /** Register a new user. Returns public profile (no password). */
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            // Return 409 with a generic message — we do not confirm that the email
            // is the specific conflict field, to limit information leakage.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An account with these details already exists.");
        }

        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .build();

        user = userRepository.save(user);
        auditService.record(AuditAction.REGISTER, AuditResourceType.USER, user.getId(), user.getId(), null);
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName());
    }

    /** Authenticate and return a new access + refresh token pair. */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> {
                    auditService.record(AuditAction.LOGIN_FAILURE, AuditResourceType.USER, null, null,
                            Map.of("email", request.email(), "reason", "user_not_found"));
                    loginCounter("failure").increment();
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
                });

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            auditService.record(AuditAction.LOGIN_FAILURE, AuditResourceType.USER, user.getId(), user.getId(),
                    Map.of("reason", "bad_password"));
            loginCounter("failure").increment();
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        AuthResponse result = issueTokenPair(user);
        auditService.record(AuditAction.LOGIN_SUCCESS, AuditResourceType.USER, user.getId(), user.getId(), null);
        loginCounter("success").increment();
        return result;
    }

    private Counter loginCounter(String outcome) {
        return Counter.builder("auth.login.count")
                .tag("outcome", outcome)
                .description("Login attempts tagged by outcome (success/failure) — early warning for brute-force")
                .register(meterRegistry);
    }

    /**
     * Validate an existing refresh token, revoke it, and issue a new pair (rotation).
     * The old refresh token is revoked in DB; a fresh one is returned.
     */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        String hash = tokenService.hashToken(rawRefreshToken);

        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        if (stored.isRevoked()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token has been revoked");
        }
        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token has expired");
        }

        // Rotation: revoke old token before issuing a new one
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return issueTokenPair(stored.getUser());
    }

    /** Revoke the refresh token in DB and blacklist the access token's jti in Redis. */
    @Transactional
    public void logout(String rawAccessToken, String rawRefreshToken) {
        // Blacklist the access token so it cannot be reused for its remaining lifetime
        UUID loggedOutUserId = null;
        try {
            Jwt jwt = tokenService.decode(rawAccessToken);
            String sub = jwt.getSubject();
            if (sub != null) {
                loggedOutUserId = UUID.fromString(sub);
            }
            tokenService.blacklist(jwt);
        } catch (JwtException | IllegalArgumentException ignored) {
            // Token already expired, malformed, or subject is not a valid UUID
        }

        // Revoke the refresh token in DB
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String hash = tokenService.hashToken(rawRefreshToken);
            refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
                rt.setRevoked(true);
                refreshTokenRepository.save(rt);
            });
        }

        auditService.record(AuditAction.LOGOUT, AuditResourceType.USER, loggedOutUserId, loggedOutUserId, null);
    }

    // ---- helpers ----

    private AuthResponse issueTokenPair(User user) {
        String accessToken = tokenService.generateAccessToken(user.getId(), user.getEmail());

        String rawRefreshToken = tokenService.generateRefreshTokenRaw();
        String hashedRefreshToken = tokenService.hashToken(rawRefreshToken);

        OffsetDateTime refreshExpiry = OffsetDateTime.now()
                .plusDays(jwtProperties.refreshTokenTtlDays());

        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .tokenHash(hashedRefreshToken)
                .expiresAt(refreshExpiry)
                .revoked(false)
                .build();
        refreshTokenRepository.save(rt);

        long expiresIn = jwtProperties.accessTokenTtlMinutes() * 60;
        return new AuthResponse(accessToken, rawRefreshToken, expiresIn);
    }
}
