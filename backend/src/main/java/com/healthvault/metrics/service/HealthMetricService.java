package com.healthvault.metrics.service;

import com.healthvault.metrics.MetricMapper;
import com.healthvault.metrics.MetricSource;
import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.dto.MetricRequest;
import com.healthvault.metrics.dto.MetricResponse;
import com.healthvault.metrics.dto.MetricUpdateRequest;
import com.healthvault.metrics.dto.PageResponse;
import com.healthvault.metrics.entity.HealthMetric;
import com.healthvault.metrics.repository.HealthMetricRepository;
import com.healthvault.metrics.repository.MetricSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HealthMetricService {

    private final HealthMetricRepository repository;
    private final MetricValidationService validationService;
    private final MetricMapper mapper;

    @Transactional(readOnly = true)
    public PageResponse<MetricResponse> findAll(UUID userId, MetricType type,
                                                OffsetDateTime from, OffsetDateTime to,
                                                Pageable pageable) {
        Specification<HealthMetric> spec = Specification
            .where(MetricSpecifications.forUser(userId))
            .and(MetricSpecifications.notDeleted());

        if (type != null) spec = spec.and(MetricSpecifications.byType(type));
        if (from != null) spec = spec.and(MetricSpecifications.fromDate(from));
        if (to   != null) spec = spec.and(MetricSpecifications.toDate(to));

        Page<MetricResponse> page = repository.findAll(spec, pageable).map(mapper::toResponse);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public MetricResponse findById(UUID userId, UUID id) {
        return repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .map(mapper::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Metric not found"));
    }

    @Transactional
    public MetricResponse create(UUID userId, MetricRequest req) {
        validationService.validate(req.metricType(), req.value());
        HealthMetric entity = HealthMetric.builder()
            .userId(userId)
            .metricType(req.metricType())
            .value(req.value())
            .recordedAt(req.recordedAt())
            .source(MetricSource.MANUAL)
            .notes(req.notes())
            .build();
        return mapper.toResponse(repository.save(entity));
    }

    @Transactional
    public MetricResponse update(UUID userId, UUID id, MetricUpdateRequest req) {
        HealthMetric entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Metric not found"));

        validationService.validate(entity.getMetricType(), req.value());
        entity.setValue(req.value());
        entity.setRecordedAt(req.recordedAt());
        entity.setNotes(req.notes());
        return mapper.toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        HealthMetric entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Metric not found"));
        entity.setDeletedAt(OffsetDateTime.now());
        repository.save(entity);
    }
}
