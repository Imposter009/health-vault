package com.healthvault.metrics.dto;

public record DashboardBucketResponse(
    String bucketStart,          // ISO date "yyyy-MM-dd"

    // Numeric metrics (WEIGHT, HEART_RATE, BLOOD_SUGAR) — null for other types
    Double avg,
    Double min,
    Double max,

    // BLOOD_PRESSURE only — null for other types
    Double avgSystolic,
    Double avgDiastolic,
    Double minSystolic,
    Double maxSystolic,

    // WORKOUT only — null for other types
    Long totalDurationMinutes,

    Long count
) {}
