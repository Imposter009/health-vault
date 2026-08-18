package com.healthvault.metrics.dto;

import com.healthvault.metrics.DashboardGranularity;
import com.healthvault.metrics.MetricType;

import java.util.List;

public record DashboardResponse(
    MetricType metricType,
    String from,
    String to,
    DashboardGranularity granularity,
    List<DashboardBucketResponse> buckets
) {}
