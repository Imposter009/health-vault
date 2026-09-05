package com.healthvault.gateway.config;

import io.micrometer.tracing.Tracer;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Gateway-side correlation ID filter.
 *
 * Strategy: use the Micrometer tracing trace ID as the canonical request ID so
 * that X-Request-ID in the response header, traceId in logs, and the Zipkin
 * span are all the same identifier — one ID to rule them all.
 *
 * If the client already sends X-Request-ID we honour it (pass-through), otherwise
 * we generate a UUID. Either way the value is forwarded to Core API on the
 * proxied request and echoed back to the client on the response.
 *
 * MDC propagation across WebFlux reactor context is handled automatically by
 * micrometer-tracing-bridge-otel + Hooks.enableAutomaticContextPropagation()
 * (enabled by Spring Boot auto-configuration). The traceId and spanId appear in
 * MDC-keyed log fields without manual ThreadLocalAccessor wiring.
 */
@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {

    static final String HEADER = "X-Request-ID";

    private final Tracer tracer;

    public CorrelationIdFilter(Tracer tracer) {
        this.tracer = tracer;
    }

    @Override
    public int getOrder() {
        // Run after RateLimitErrorFilter (HIGHEST_PRECEDENCE) but before routing filters
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // Prefer the active trace ID; fall back to client-supplied header; then generate UUID
        String requestId = resolveRequestId(exchange);

        // Mutate the forwarded request to include X-Request-ID → Core API reads it
        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .header(HEADER, requestId)
                .build();

        // Echo back to the client on the response
        exchange.getResponse().getHeaders().set(HEADER, requestId);

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private String resolveRequestId(ServerWebExchange exchange) {
        // Prefer the Micrometer trace ID (non-null when a span is active)
        if (tracer.currentSpan() != null && tracer.currentSpan().context() != null) {
            String traceId = tracer.currentSpan().context().traceId();
            if (traceId != null && !traceId.isBlank()) {
                return traceId;
            }
        }
        // Fall back to client-supplied header
        String clientHeader = exchange.getRequest().getHeaders().getFirst(HEADER);
        if (clientHeader != null && !clientHeader.isBlank()) {
            return clientHeader;
        }
        // Last resort: generate a fresh UUID
        return UUID.randomUUID().toString();
    }
}
