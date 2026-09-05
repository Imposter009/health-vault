package com.healthvault.gateway.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Intercepts 429 responses (from the RequestRateLimiter filter) and writes a
 * structured JSON body. By default Spring Cloud Gateway calls response.setComplete()
 * with no body when the rate limit fires; this decorator intercepts that path.
 * Also increments gateway.ratelimit.rejected.count tagged by route ID.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitErrorFilter implements GlobalFilter {

    private static final byte[] BODY_429 =
            "{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"Rate limit exceeded. Please slow down and try again later.\"}"
            .getBytes(StandardCharsets.UTF_8);

    private final MeterRegistry meterRegistry;

    public RateLimitErrorFilter(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpResponse original = exchange.getResponse();
        ServerHttpResponseDecorator decorated = new ServerHttpResponseDecorator(original) {
            @Override
            public Mono<Void> setComplete() {
                if (HttpStatus.TOO_MANY_REQUESTS.equals(getStatusCode())) {
                    // Resolve the matched route ID for the tag; fall back to "unknown"
                    Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
                    String routeId = route != null ? route.getId() : "unknown";
                    Counter.builder("gateway.ratelimit.rejected.count")
                            .tag("route", routeId)
                            .description("Requests rejected by the gateway rate limiter, tagged by route")
                            .register(meterRegistry)
                            .increment();

                    getHeaders().setContentType(MediaType.APPLICATION_JSON);
                    getHeaders().setContentLength(BODY_429.length);
                    DataBuffer buffer = original.bufferFactory().wrap(BODY_429);
                    return writeWith(Mono.just(buffer));
                }
                return super.setComplete();
            }
        };
        return chain.filter(exchange.mutate().response(decorated).build());
    }
}
