package com.healthvault.ai.dto;

import java.util.List;
import java.util.UUID;

public record ChatResponse(
        UUID         conversationId,
        String       answer,
        List<Source> sources
) {
    public record Source(UUID documentId, int chunkIndex) {}
}
