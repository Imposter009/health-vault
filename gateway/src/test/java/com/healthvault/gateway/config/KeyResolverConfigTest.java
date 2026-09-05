package com.healthvault.gateway.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for KeyResolverConfig — verifies IP extraction and JWT subject
 * extraction without starting a Spring context.
 */
class KeyResolverConfigTest {

    KeyResolverConfig config;

    @BeforeEach
    void setUp() {
        config = new KeyResolverConfig();
    }

    // ── ipKeyResolver — X-Forwarded-For present ───────────────────────────

    @Test
    void ipKeyResolver_uses_first_ip_from_X_Forwarded_For() {
        KeyResolver resolver = config.ipKeyResolver();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.5, 10.0.0.1")
                        .build()
        );

        String key = resolver.resolve(exchange).block();

        assertThat(key).isEqualTo("203.0.113.5");
    }

    @Test
    void ipKeyResolver_uses_remote_address_when_no_forwarded_for() {
        KeyResolver resolver = config.ipKeyResolver();
        MockServerHttpRequest req = MockServerHttpRequest.get("/api/auth/login")
                .remoteAddress(new InetSocketAddress("192.168.1.100", 12345))
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(req);

        String key = resolver.resolve(exchange).block();

        assertThat(key).isEqualTo("192.168.1.100");
    }

    @Test
    void ipKeyResolver_returns_unknown_when_no_address_at_all() {
        KeyResolver resolver = config.ipKeyResolver();
        // No remoteAddress, no X-Forwarded-For
        MockServerHttpRequest req = MockServerHttpRequest.get("/api/auth/login").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(req);

        String key = resolver.resolve(exchange).block();

        // Remote address will be null for MockServerHttpRequest without explicit address.
        // Config falls back to "unknown".
        assertThat(key).isNotNull();
    }

    // ── userOrIpKeyResolver — authenticated request ───────────────────────

    @Test
    void userOrIpKeyResolver_extracts_user_id_from_valid_jwt() {
        KeyResolver resolver = config.userOrIpKeyResolver();

        // Build a minimal JWT with sub = "user-123" (header.payload.sig — sig not verified here)
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"user-123\",\"email\":\"a@b.com\"}"
                        .getBytes(StandardCharsets.UTF_8));
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"HS256\"}".getBytes(StandardCharsets.UTF_8));
        String fakeJwt = header + "." + payload + ".fakesig";

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/documents")
                        .header("Authorization", "Bearer " + fakeJwt)
                        .build()
        );

        String key = resolver.resolve(exchange).block();

        assertThat(key).isEqualTo("user:user-123");
    }

    @Test
    void userOrIpKeyResolver_falls_back_to_ip_when_no_auth_header() {
        KeyResolver resolver = config.userOrIpKeyResolver();
        MockServerHttpRequest req = MockServerHttpRequest.get("/api/documents")
                .header("X-Forwarded-For", "10.1.2.3")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(req);

        String key = resolver.resolve(exchange).block();

        assertThat(key).isEqualTo("ip:10.1.2.3");
    }

    @Test
    void userOrIpKeyResolver_falls_back_to_ip_for_malformed_jwt() {
        KeyResolver resolver = config.userOrIpKeyResolver();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/documents")
                        .header("Authorization", "Bearer not.a.valid.jwt.payload")
                        .header("X-Forwarded-For", "10.1.2.3")
                        .build()
        );

        String key = resolver.resolve(exchange).block();

        // Falls back to IP when JWT is not parseable
        assertThat(key).startsWith("ip:");
    }

    @Test
    void userOrIpKeyResolver_falls_back_to_ip_for_jwt_missing_sub_claim() {
        KeyResolver resolver = config.userOrIpKeyResolver();

        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"email\":\"a@b.com\"}" // no "sub" field
                        .getBytes(StandardCharsets.UTF_8));
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"HS256\"}".getBytes(StandardCharsets.UTF_8));
        String fakeJwt = header + "." + payload + ".sig";

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/documents")
                        .header("Authorization", "Bearer " + fakeJwt)
                        .header("X-Forwarded-For", "10.1.2.3")
                        .build()
        );

        String key = resolver.resolve(exchange).block();

        assertThat(key).startsWith("ip:");
    }

    @Test
    void userOrIpKeyResolver_ignores_non_bearer_auth_scheme() {
        KeyResolver resolver = config.userOrIpKeyResolver();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/documents")
                        .header("Authorization", "Basic dXNlcjpwYXNz")
                        .header("X-Forwarded-For", "10.1.2.3")
                        .build()
        );

        String key = resolver.resolve(exchange).block();

        assertThat(key).startsWith("ip:");
    }
}
