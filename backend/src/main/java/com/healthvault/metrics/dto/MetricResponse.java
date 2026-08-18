package com.healthvault.metrics.dto;

import com.healthvault.metrics.MetricSource;
import com.healthvault.metrics.MetricType;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record MetricResponse(
    UUID id,
    UUID userId,
    MetricType metricType,
    Map<String, Object> value,
    OffsetDateTime recordedAt,
    MetricSource source,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
