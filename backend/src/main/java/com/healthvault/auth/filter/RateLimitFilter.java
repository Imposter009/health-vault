package com.healthvault.auth.filter;

import com.healthvault.auth.config.RateLimitProperties;
import com.healthvault.common.ClientIpResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Fixed-window rate limiter backed by Redis, applied to sensitive auth endpoints.
 * Key format: rate_limit:{endpoint-slug}:{client-ip}:{window-bucket}
 * Fail-open: if Redis is unavailable, the request is allowed through with a warning.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register"
    );

    private final RateLimitProperties rateLimitProperties;
    private final StringRedisTemplate redisTemplate;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain
    ) throws ServletException, IOException {

        String path = request.getRequestURI();

        if (!RATE_LIMITED_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = ClientIpResolver.resolve(request);
        String slug = path.replace("/api/auth/", "").replace("/", "-");
        long windowBucket = System.currentTimeMillis() / (rateLimitProperties.windowSeconds() * 1000L);
        String redisKey = "rate_limit:" + slug + ":" + clientIp + ":" + windowBucket;

        try {
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count != null && count == 1) {
                redisTemplate.expire(redisKey, rateLimitProperties.windowSeconds(), TimeUnit.SECONDS);
            }
            if (count != null && count > rateLimitProperties.maxRequests()) {
                sendTooManyRequests(response);
                return;
            }
        } catch (Exception e) {
            // Fail open — don't block requests if Redis is unavailable
            log.warn("Rate limit check failed for key={}; failing open (request allowed through)", redisKey, e);
        }

        chain.doFilter(request, response);
    }

    private void sendTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"error\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please try again later.\"}"
        );
    }
}
