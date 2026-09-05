package com.healthvault.integration;

import com.healthvault.auth.dto.AuthResponse;
import com.healthvault.auth.dto.LoginRequest;
import com.healthvault.auth.dto.RefreshRequest;
import com.healthvault.auth.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full auth flow against real Postgres + Redis (via Testcontainers).
 *
 * This is the single most valuable integration test: auth bugs are the most
 * costly to ship. Every assertion here exercises a real security boundary.
 *
 * Flow:
 *   register → login → access protected endpoint
 *       → refresh → logout → confirm blacklisted token rejected
 */
class AuthIntegrationTest extends BaseIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    private static final String EMAIL = "it-user@healthvault.test";
    private static final String PASS  = "SecurePass@1234";

    // ── Full sequential auth flow ─────────────────────────────────────────

    @Test
    void full_auth_lifecycle() {
        // 1. Register a new user
        ResponseEntity<Map> regResp = rest.postForEntity(
                "/api/auth/register",
                new RegisterRequest(EMAIL, PASS, "IT User"),
                Map.class);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // 2. Login
        ResponseEntity<AuthResponse> loginResp = rest.postForEntity(
                "/api/auth/login",
                new LoginRequest(EMAIL, PASS),
                AuthResponse.class);
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        AuthResponse tokens = loginResp.getBody();
        assertThat(tokens).isNotNull();
        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.refreshToken()).isNotBlank();
        assertThat(tokens.expiresIn()).isEqualTo(900L); // 15 min * 60

        // 3. Access protected endpoint with access token
        HttpHeaders headers = bearerHeaders(tokens.accessToken());
        ResponseEntity<Map> meResp = rest.exchange(
                "/api/users/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((String) meResp.getBody().get("email")).isEqualTo(EMAIL);

        // 4. Refresh — old pair out, new pair issued
        ResponseEntity<AuthResponse> refreshResp = rest.postForEntity(
                "/api/auth/refresh",
                new RefreshRequest(tokens.refreshToken()),
                AuthResponse.class);
        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        AuthResponse newTokens = refreshResp.getBody();
        assertThat(newTokens.accessToken()).isNotBlank();
        assertThat(newTokens.refreshToken()).isNotBlank();
        // New tokens must be different
        assertThat(newTokens.accessToken()).isNotEqualTo(tokens.accessToken());
        assertThat(newTokens.refreshToken()).isNotEqualTo(tokens.refreshToken());

        // 5. Old refresh token must now be rejected (token rotation)
        ResponseEntity<Map> oldRefreshResp = rest.postForEntity(
                "/api/auth/refresh",
                new RefreshRequest(tokens.refreshToken()),
                Map.class);
        assertThat(oldRefreshResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // 6. Logout with new tokens
        HttpHeaders logoutHeaders = bearerHeaders(newTokens.accessToken());
        Map<String, String> logoutBody = Map.of("refreshToken", newTokens.refreshToken());
        ResponseEntity<Void> logoutResp = rest.exchange(
                "/api/auth/logout",
                HttpMethod.POST,
                new HttpEntity<>(logoutBody, logoutHeaders),
                Void.class);
        assertThat(logoutResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // 7. Blacklisted access token must now be rejected
        ResponseEntity<Map> afterLogout = rest.exchange(
                "/api/users/me",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(newTokens.accessToken())),
                Map.class);
        assertThat(afterLogout.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── Negative paths ────────────────────────────────────────────────────

    @Test
    void login_with_wrong_password_returns_401() {
        // Register first so user exists
        rest.postForEntity("/api/auth/register",
                new RegisterRequest("wrong-pw@test.com", PASS, "Test"), Map.class);

        ResponseEntity<Map> resp = rest.postForEntity(
                "/api/auth/login",
                new LoginRequest("wrong-pw@test.com", "WrongPassword!"),
                Map.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void login_with_unknown_email_returns_401() {
        ResponseEntity<Map> resp = rest.postForEntity(
                "/api/auth/login",
                new LoginRequest("nobody@nowhere.com", "anything"),
                Map.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void duplicate_registration_returns_409() {
        String email = "dup-" + System.currentTimeMillis() + "@test.com";
        rest.postForEntity("/api/auth/register",
                new RegisterRequest(email, PASS, "First"), Map.class);

        ResponseEntity<Map> second = rest.postForEntity("/api/auth/register",
                new RegisterRequest(email, PASS, "Second"), Map.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void protected_endpoint_without_token_returns_401() {
        ResponseEntity<Map> resp = rest.getForEntity("/api/users/me", Map.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
