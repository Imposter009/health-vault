package com.healthvault.ai.dto;

import java.util.UUID;

public record SummarizeResponse(
        UUID   documentId,
        String summary,
        boolean fromCache
) {}
