package com.healthvault.metrics.repository;

import com.healthvault.metrics.entity.HealthMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface HealthMetricRepository
        extends JpaRepository<HealthMetric, UUID>, JpaSpecificationExecutor<HealthMetric> {

    // Combines id + userId ownership check + soft-delete guard in one query.
    // Returns empty if not found OR not owned by userId — prevents existence leakage.
    Optional<HealthMetric> findByIdAndUserIdAndDeletedAtIsNull(UUID id, UUID userId);
}
