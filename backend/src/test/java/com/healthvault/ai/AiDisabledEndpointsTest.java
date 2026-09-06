package com.healthvault.ai;

import com.healthvault.auth.dto.AuthResponse;
import com.healthvault.auth.dto.LoginRequest;
import com.healthvault.auth.dto.RegisterRequest;
import com.healthvault.integration.BaseIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies that all /api/ai/** endpoints return HTTP 503 when AI is disabled.
 *
 * Extends BaseIntegrationTest for Testcontainers (Postgres, Redis, etc.) which
 * are needed to start the full Spring Boot context and register a test user.
 *
 * application-test.yml sets healthvault.ai.enabled=false so:
 * - AiDisabledController is the active handler for /api/ai/**
 * - AiConfig, EmbeddingService, RagChatService, etc. are NOT instantiated
 * - No OpenAI API key is needed
 */
class AiDisabledEndpointsTest extends BaseIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    private String base() {
        return "http://localhost:" + port;
    }

    /** Register + login, return a valid Bearer token. */
    private String accessToken() {
        String email    = "ai-test-" + UUID.randomUUID() + "@example.com";
        String password = "Password1!";
        rest.postForEntity(base() + "/api/auth/register",
                new RegisterRequest(email, password, "AI Tester"), Void.class);
        ResponseEntity<AuthResponse> login = rest.postForEntity(
                base() + "/api/auth/login",
                new LoginRequest(email, password), AuthResponse.class);
        assertNotNull(login.getBody());
        return login.getBody().accessToken();
    }

    private HttpHeaders bearer(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }

    @Test
    void statusEndpointAlwaysReturnsEnabledFalse() {
        // Status is unauthenticated
        ResponseEntity<String> response = rest.getForEntity(base() + "/api/ai/status", String.class);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() != null && response.getBody().contains("\"enabled\":false"),
                "Status endpoint must return {enabled: false}, got: " + response.getBody());
    }

    @Test
    void summarizeEndpointReturns503WhenAiDisabled() {
        String token = accessToken();
        ResponseEntity<String> response = rest.exchange(
                base() + "/api/ai/documents/" + UUID.randomUUID() + "/summary",
                HttpMethod.GET,
                new HttpEntity<>(bearer(token)),
                String.class);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode(),
                "Summarize endpoint must return 503 when AI is disabled");
    }

    @Test
    void chatEndpointReturns503WhenAiDisabled() {
        String token = accessToken();
        HttpHeaders headers = bearer(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = rest.exchange(
                base() + "/api/ai/chat",
                HttpMethod.POST,
                new HttpEntity<>("{\"question\":\"hello\"}", headers),
                String.class);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode(),
                "Chat endpoint must return 503 when AI is disabled");
    }

    @Test
    void trendEndpointReturns503WhenAiDisabled() {
        String token = accessToken();
        ResponseEntity<String> response = rest.exchange(
                base() + "/api/ai/metrics/trend/WEIGHT",
                HttpMethod.GET,
                new HttpEntity<>(bearer(token)),
                String.class);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode(),
                "Trend endpoint must return 503 when AI is disabled");
    }
}
