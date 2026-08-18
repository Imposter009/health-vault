package com.healthvault.documents.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "document")
public record DocumentProperties(
    long maxSizeBytes,
    List<String> allowedMimeTypes
) {}
