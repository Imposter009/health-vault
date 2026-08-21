package com.healthvault.documents.dto;

import com.healthvault.documents.DocumentStatus;

import java.time.OffsetDateTime;

public record DocumentStatusResponse(
    DocumentStatus status,
    OffsetDateTime processedAt,
    int metricsExtracted,
    String processingError
) {}
