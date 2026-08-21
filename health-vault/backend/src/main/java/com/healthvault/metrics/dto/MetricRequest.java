package com.healthvault.metrics.dto;

import com.healthvault.metrics.MetricType;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.Map;

public record MetricRequest(
    @NotNull MetricType metricType,
    @NotNull Map<String, Object> value,
    @NotNull OffsetDateTime recordedAt,
    String notes
) {}
