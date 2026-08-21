package com.healthvault.documents.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "minio")
public record MinioProperties(
    String endpoint,
    String accessKey,
    String secretKey,
    String bucketName,
    int presignedUrlExpiryMinutes
) {}
