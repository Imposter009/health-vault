package com.healthvault.metrics;

import com.healthvault.metrics.dto.MetricResponse;
import com.healthvault.metrics.entity.HealthMetric;
import org.springframework.stereotype.Component;

@Component
public class MetricMapper {

    public MetricResponse toResponse(HealthMetric m) {
        return new MetricResponse(
            m.getId(),
            m.getUserId(),
            m.getMetricType(),
            m.getValue(),
            m.getRecordedAt(),
            m.getSource(),
            m.getNotes(),
            m.getCreatedAt(),
            m.getUpdatedAt()
        );
    }
}
