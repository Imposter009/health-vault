package com.healthvault.gateway;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Verifies that the gateway returns 429 when the rate limiter denies a request.
 *
 * Strategy: @MockBean the RedisRateLimiter so no real Redis is needed. The mock
 * returns "allowed" for the first N calls and "denied" thereafter. MockWebServer
 * acts as the Core API backend.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
class GatewayRateLimitTest {

    static MockWebServer backendServer;

    @SuppressWarnings("rawtypes")
    @MockBean
    RateLimiter rateLimiter;

    @Autowired
    WebTestClient webTestClient;

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) throws IOException {
        backendServer = new MockWebServer();
        backendServer.start();
        registry.add("CORE_API_URL", () -> backendServer.url("/").toString().replaceAll("/$", ""));
        // Point Redis at a non-existent host — mocked rate limiter means it's never contacted
        registry.add("spring.data.redis.host", () -> "localhost");
        registry.add("spring.data.redis.port", () -> "6399");
    }

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        // First request: allowed
        when(rateLimiter.isAllowed(any(), any(), any())).thenReturn(
                reactor.core.publisher.Mono.just(new RateLimiter.Response(true, Map.of())),
                // Second request: denied (rate limited)
                reactor.core.publisher.Mono.just(new RateLimiter.Response(false, Map.of()))
        );
    }

    @AfterEach
    void tearDown() throws IOException {
        backendServer.shutdown();
    }

    @Test
    void loginEndpoint_firstRequest_proxiedToBackend() {
        backendServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody("{\"accessToken\":\"tok\",\"refreshToken\":\"ref\",\"expiresIn\":900}"));

        webTestClient.post()
                .uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"email\":\"a@b.com\",\"password\":\"pass\"}")
                .exchange()
                .expectStatus().isOk();
    }

    @Test
    void loginEndpoint_afterRateLimitExceeded_returns429WithJson() {
        // Second call is denied — no backend response needed
        webTestClient.post()
                .uri("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"email\":\"a@b.com\",\"password\":\"pass\"}")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
                .expectHeader().contentType(MediaType.APPLICATION_JSON)
                .expectBody()
                .jsonPath("$.error").isEqualTo("TOO_MANY_REQUESTS");
    }
}
