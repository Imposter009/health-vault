package com.healthvault.metrics.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.service.AuditService;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HealthMetricService {

    private final HealthMetricRepository repository;
    private final MetricValidationService validationService;
    private final MetricMapper mapper;
    private final AuditService auditService;

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
        MetricResponse created = mapper.toResponse(repository.save(entity));
        auditService.record(AuditAction.METRIC_CREATED, AuditResourceType.HEALTH_METRIC,
                created.id(), userId, Map.of("metricType", req.metricType().name()));
        return created;
    }

    @Transactional
    public MetricResponse update(UUID userId, UUID id, MetricUpdateRequest req) {
        HealthMetric entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Metric not found"));

        List<String> changed = new ArrayList<>();
        if (!Objects.equals(entity.getValue(), req.value())) changed.add("value");
        if (!Objects.equals(entity.getRecordedAt(), req.recordedAt())) changed.add("recordedAt");
        if (!Objects.equals(entity.getNotes(), req.notes())) changed.add("notes");

        validationService.validate(entity.getMetricType(), req.value());
        entity.setValue(req.value());
        entity.setRecordedAt(req.recordedAt());
        entity.setNotes(req.notes());
        MetricResponse updated = mapper.toResponse(repository.save(entity));
        auditService.record(AuditAction.METRIC_UPDATED, AuditResourceType.HEALTH_METRIC, id, userId,
                changed.isEmpty() ? null : Map.of("changedFields", changed));
        return updated;
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        HealthMetric entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Metric not found"));
        entity.setDeletedAt(OffsetDateTime.now());
        repository.save(entity);
        auditService.record(AuditAction.METRIC_DELETED, AuditResourceType.HEALTH_METRIC, id, userId, null);
    }
}
