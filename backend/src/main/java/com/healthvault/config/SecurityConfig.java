package com.healthvault.config;

import com.healthvault.auth.filter.JwtAuthenticationFilter;
import com.healthvault.auth.filter.RateLimitFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtFilter,
            RateLimitFilter rateLimitFilter
    ) throws Exception {
        http
            // Rate limiter runs first (before JWT extraction)
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            // JWT filter runs before Spring's username/password filter
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            // CORS is handled exclusively by the Gateway (see gateway/application.yml's
            // globalcors config) — the Gateway is the only entry point browsers talk to.
            // Core API must NOT also set Access-Control-Allow-Origin, or the browser sees
            // it duplicated (once from Core API's response, once added by the Gateway) and
            // rejects the response outright ("contains multiple values").
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Disable anonymous filter so unauthenticated requests throw AuthenticationException → 401,
            // not AccessDeniedException → 403 (which is semantically wrong for "no token provided")
            .anonymous(AbstractHttpConfigurer::disable)
            .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write("{\"error\":\"UNAUTHORIZED\",\"message\":\"Authentication required\"}");
            }))
            .authorizeHttpRequests(auth -> auth
                // Public auth endpoints (register/login/refresh don't need a token;
                // logout needs the JWT filter to run but the path is still permitAll —
                // the filter extracts and blacklists the token regardless)
                .requestMatchers("/api/auth/**").permitAll()
                // /actuator/health/** is public so Docker/load-balancer healthchecks work without a token.
                // All other actuator endpoints (including /actuator/prometheus) require authentication
                // to prevent unauthenticated metric scraping (A05-001 fix).
                .requestMatchers("/api/health", "/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/actuator/**").authenticated()
                // AI status is public so the Angular SPA can discover AI availability before login
                .requestMatchers("/api/ai/status").permitAll()
                // Everything else requires a valid JWT
                .anyRequest().authenticated()
            )
            .csrf(AbstractHttpConfigurer::disable);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
