package com.healthvault.ai.dto;

public record NarrationResponse(
        boolean hasTrend,
        String  narration,     // null when hasTrend=false
        String  direction,     // "increasing" | "decreasing" | "flat"
        double  percentChange,
        boolean fromCache
) {}
