package com.healthvault.gateway.config;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

@Configuration
public class ObservabilityConfig {

    @Value("${spring.application.name}")
    private String appName;

    @Bean
    MeterRegistryCustomizer<MeterRegistry> commonTags(Environment env) {
        String activeProfiles = env.getActiveProfiles().length > 0
                ? String.join(",", Arrays.asList(env.getActiveProfiles()))
                : "default";
        return registry -> registry.config()
                .commonTags("application", appName, "environment", activeProfiles);
    }
}
