package com.healthvault.config;

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

    /**
     * Tag every metric with the application name and active Spring profile so
     * Grafana dashboards can filter/group by module and environment correctly.
     */
    @Bean
    MeterRegistryCustomizer<MeterRegistry> commonTags(Environment env) {
        String activeProfiles = env.getActiveProfiles().length > 0
                ? String.join(",", Arrays.asList(env.getActiveProfiles()))
                : "default";
        return registry -> registry.config()
                .commonTags("application", appName, "environment", activeProfiles);
    }
}
