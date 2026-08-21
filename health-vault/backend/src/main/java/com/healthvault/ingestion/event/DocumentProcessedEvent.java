package com.healthvault.ingestion.event;

import java.util.UUID;

public record DocumentProcessedEvent(UUID documentId, UUID userId, String status, int metricsExtracted) {}
