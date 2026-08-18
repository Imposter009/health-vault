package com.healthvault.documents.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

@Configuration
@Slf4j
public class MinioConfig {

    private final MinioProperties properties;

    public MinioConfig(MinioProperties properties) {
        this.properties = properties;
    }

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
            .endpoint(properties.endpoint())
            .credentials(properties.accessKey(), properties.secretKey())
            .build();
    }

    // Use ApplicationReadyEvent instead of @PostConstruct to avoid circular dependency
    // (calling the @Bean factory method from within the same @Configuration class during
    // its own bean initialization causes Spring's circular-reference detection to fire).
    @EventListener(ApplicationReadyEvent.class)
    public void initBucket(ApplicationReadyEvent event) {
        MinioClient client = event.getApplicationContext().getBean(MinioClient.class);
        try {
            boolean exists = client.bucketExists(
                BucketExistsArgs.builder().bucket(properties.bucketName()).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(properties.bucketName()).build());
                log.info("Created MinIO bucket '{}'", properties.bucketName());
            } else {
                log.info("MinIO bucket '{}' already exists", properties.bucketName());
            }
        } catch (Exception e) {
            // Don't fail startup — uploads will fail at runtime with a clear error message.
            log.error("Could not initialize MinIO bucket '{}': {}", properties.bucketName(), e.getMessage());
        }
    }
}
