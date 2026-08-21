package com.healthvault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan   // picks up JwtProperties, RateLimitProperties records
public class HealthVaultApplication {

    public static void main(String[] args) {
        SpringApplication.run(HealthVaultApplication.class, args);
    }
}
