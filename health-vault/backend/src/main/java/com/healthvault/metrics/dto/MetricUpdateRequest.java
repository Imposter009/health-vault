package com.healthvault.metrics.dto;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.Map;

// metricType is intentionally absent — changing type on an existing record is not allowed.
// Callers must delete and recreate if they need a different type.
public record MetricUpdateRequest(
    @NotNull Map<String, Object> value,
    @NotNull OffsetDateTime recordedAt,
    String notes
) {}
