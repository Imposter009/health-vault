package com.healthvault.metrics.repository;

import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.entity.HealthMetric;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class MetricSpecifications {

    private MetricSpecifications() {}

    public static Specification<HealthMetric> forUser(UUID userId) {
        return (root, q, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<HealthMetric> notDeleted() {
        return (root, q, cb) -> cb.isNull(root.get("deletedAt"));
    }

    public static Specification<HealthMetric> byType(MetricType type) {
        return (root, q, cb) -> cb.equal(root.get("metricType"), type);
    }

    public static Specification<HealthMetric> fromDate(OffsetDateTime from) {
        return (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("recordedAt"), from);
    }

    public static Specification<HealthMetric> toDate(OffsetDateTime to) {
        return (root, q, cb) -> cb.lessThanOrEqualTo(root.get("recordedAt"), to);
    }
}
