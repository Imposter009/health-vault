package com.healthvault.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the originating client IP from a request, preferring the first entry
 * of X-Forwarded-For (set by the gateway/load balancer) over the direct socket
 * address, which would otherwise just be the upstream proxy's own IP.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {}

    public static String resolve(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
