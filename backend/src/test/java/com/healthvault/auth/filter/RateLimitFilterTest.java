package com.healthvault.auth.filter;

import com.healthvault.auth.config.RateLimitProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RateLimitFilterTest {

    @Mock RateLimitProperties         rateLimitProperties;
    @Mock StringRedisTemplate         redisTemplate;
    @Mock ValueOperations<String, String> valueOps;
    @Mock HttpServletRequest          request;
    @Mock HttpServletResponse         response;
    @Mock FilterChain                 chain;

    @InjectMocks
    RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        when(rateLimitProperties.windowSeconds()).thenReturn(60);
        when(rateLimitProperties.maxRequests()).thenReturn(5);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    // ── Non-rate-limited paths ────────────────────────────────────────────

    @Test
    void non_rate_limited_path_passes_through_without_touching_redis() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/metrics");
        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void health_check_path_passes_without_redis() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/health");
        filter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
        verifyNoInteractions(redisTemplate);
    }

    // ── Rate-limited paths — under limit ──────────────────────────────────

    @Test
    void first_request_to_login_is_allowed() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(Boolean.TRUE);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    void request_at_max_threshold_is_still_allowed() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/register");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(valueOps.increment(anyString())).thenReturn(5L);  // exactly at limit

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    // ── Rate-limited paths — over limit ───────────────────────────────────

    @Test
    void sixth_request_is_rejected_with_429() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(valueOps.increment(anyString())).thenReturn(6L);  // over limit of 5

        PrintWriter writer = new PrintWriter(new StringWriter());
        when(response.getWriter()).thenReturn(writer);

        filter.doFilterInternal(request, response, chain);

        verify(response).setStatus(429);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void rejected_response_body_contains_RATE_LIMIT_EXCEEDED() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(valueOps.increment(anyString())).thenReturn(99L);

        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        filter.doFilterInternal(request, response, chain);

        assertThat(body.toString()).contains("RATE_LIMIT_EXCEEDED");
    }

    // ── Client IP resolution ──────────────────────────────────────────────

    @Test
    void uses_first_ip_from_X_Forwarded_For_header() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.1, 10.0.0.1");
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(Boolean.TRUE);

        filter.doFilterInternal(request, response, chain);

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOps).increment(keyCaptor.capture());
        assertThat(keyCaptor.getValue()).contains("203.0.113.1");
        assertThat(keyCaptor.getValue()).doesNotContain("10.0.0.1");
    }

    @Test
    void falls_back_to_remoteAddr_when_no_forwarded_for() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("192.168.1.55");
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(Boolean.TRUE);

        filter.doFilterInternal(request, response, chain);

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOps).increment(keyCaptor.capture());
        assertThat(keyCaptor.getValue()).contains("192.168.1.55");
    }

    // ── Redis key structure ───────────────────────────────────────────────

    @Test
    void redis_key_contains_endpoint_slug_and_client_ip() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("1.2.3.4");
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(Boolean.TRUE);

        filter.doFilterInternal(request, response, chain);

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOps).increment(keyCaptor.capture());
        String key = keyCaptor.getValue();
        assertThat(key).startsWith("rate_limit:");
        assertThat(key).contains("login");
        assertThat(key).contains("1.2.3.4");
    }

    @Test
    void first_request_in_window_sets_expiry() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("1.2.3.4");
        when(valueOps.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), anyLong(), any())).thenReturn(Boolean.TRUE);

        filter.doFilterInternal(request, response, chain);

        // count == 1 → TTL must be set
        verify(redisTemplate).expire(anyString(), eq(60L), any());
    }

    @Test
    void subsequent_requests_do_not_reset_expiry() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("1.2.3.4");
        when(valueOps.increment(anyString())).thenReturn(3L);  // not first

        filter.doFilterInternal(request, response, chain);

        // count != 1 → expire() must not be called
        verify(redisTemplate, never()).expire(anyString(), anyLong(), any());
    }

    // ── Fail-open behaviour ───────────────────────────────────────────────

    @Test
    void redis_exception_allows_request_through_fail_open() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/auth/login");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(request.getRemoteAddr()).thenReturn("1.2.3.4");
        when(valueOps.increment(anyString())).thenThrow(new RuntimeException("Redis unavailable"));

        filter.doFilterInternal(request, response, chain);

        // Must still forward the request — fail open
        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }
}
