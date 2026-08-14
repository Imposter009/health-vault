package com.healthvault.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Public: app-level health check, Actuator, and future auth endpoints
                .requestMatchers("/api/health", "/actuator/**", "/api/auth/**").permitAll()
                // Everything else requires authentication (JWT filter wired in Phase 2+)
                .anyRequest().authenticated()
            )
            // CSRF disabled for stateless REST API — re-evaluate when session auth is added
            .csrf(AbstractHttpConfigurer::disable)
            // Placeholder bearer until JWT filter is implemented in Phase 2
            .httpBasic(Customizer.withDefaults());

        return http.build();
    }
}
