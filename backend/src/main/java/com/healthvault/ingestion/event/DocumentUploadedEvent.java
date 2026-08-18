package com.healthvault.ingestion.event;

import java.util.UUID;

public record DocumentUploadedEvent(UUID documentId, UUID userId) {}
