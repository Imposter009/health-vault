package com.healthvault.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Configuration
public class KeyResolverConfig {

    /**
     * Rate-limit key: client IP address.
     * Used for public endpoints (login, register) where no JWT is present.
     * Marked @Primary so Spring can unambiguously inject KeyResolver when a
     * single bean is required (e.g. Spring Cloud Gateway auto-configuration).
     */
    @Bean
    @Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> Mono.just(resolveIp(exchange));
    }

    /**
     * Rate-limit key: JWT subject (user ID) if present, otherwise client IP.
     * Used for authenticated endpoints like document upload.
     * JWT signature is NOT verified here — this key is only for rate limiting, not auth.
     */
    @Bean
    public KeyResolver userOrIpKeyResolver() {
        return exchange -> {
            String auth = exchange.getRequest().getHeaders().getFirst("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                String sub = extractJwtSubject(auth.substring(7));
                if (sub != null) {
                    return Mono.just("user:" + sub);
                }
            }
            return Mono.just("ip:" + resolveIp(exchange));
        };
    }

    /** Client IP, preferring the first X-Forwarded-For entry over the raw socket address. */
    private String resolveIp(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return exchange.getRequest().getRemoteAddress() != null
                ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
    }

    /**
     * Extract JWT subject without signature verification.
     * Returns null if the token is malformed.
     */
    private String extractJwtSubject(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            byte[] payloadBytes = Base64.getUrlDecoder().decode(padBase64(parts[1]));
            String payload = new String(payloadBytes, StandardCharsets.UTF_8);
            // Simple JSON key extraction — avoids a full JSON library dependency
            int subStart = payload.indexOf("\"sub\"");
            if (subStart == -1) return null;
            int colon = payload.indexOf(':', subStart);
            if (colon == -1) return null;
            int quote1 = payload.indexOf('"', colon);
            if (quote1 == -1) return null;
            int quote2 = payload.indexOf('"', quote1 + 1);
            if (quote2 == -1) return null;
            return payload.substring(quote1 + 1, quote2);
        } catch (Exception e) {
            return null;
        }
    }

    private String padBase64(String s) {
        return switch (s.length() % 4) {
            case 2 -> s + "==";
            case 3 -> s + "=";
            default -> s;
        };
    }
}
