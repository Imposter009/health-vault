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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthMetricServiceTest {

    @Mock HealthMetricRepository repository;
    @Mock MetricValidationService validationService;
    @Mock MetricMapper mapper;
    @InjectMocks HealthMetricService svc;

    private final UUID userId   = UUID.randomUUID();
    private final UUID metricId = UUID.randomUUID();
    private HealthMetric entity;
    private MetricResponse response;

    @BeforeEach
    void setUp() {
        entity = HealthMetric.builder()
            .userId(userId)
            .metricType(MetricType.WEIGHT)
            .value(Map.of("kg", 72.5))
            .recordedAt(OffsetDateTime.now())
            .source(MetricSource.MANUAL)
            .build();
        // Use reflection to set id since it's generated
        try {
            var f = HealthMetric.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, metricId);
        } catch (Exception e) { throw new RuntimeException(e); }

        response = new MetricResponse(metricId, userId, MetricType.WEIGHT,
            Map.of("kg", 72.5), OffsetDateTime.now(), MetricSource.MANUAL,
            null, OffsetDateTime.now(), OffsetDateTime.now());
    }

    // ---- create ----

    @Test
    void create_callsValidationAndSaves() {
        MetricRequest req = new MetricRequest(MetricType.WEIGHT,
            Map.of("kg", 72.5), OffsetDateTime.now(), null);
        when(repository.save(any())).thenReturn(entity);
        when(mapper.toResponse(entity)).thenReturn(response);

        MetricResponse result = svc.create(userId, req);

        verify(validationService).validate(MetricType.WEIGHT, Map.of("kg", 72.5));
        verify(repository).save(any(HealthMetric.class));
        assertThat(result).isEqualTo(response);
    }

    // ---- findById ----

    @Test
    void findById_found() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, userId))
            .thenReturn(Optional.of(entity));
        when(mapper.toResponse(entity)).thenReturn(response);

        MetricResponse result = svc.findById(userId, metricId);
        assertThat(result).isEqualTo(response);
    }

    @Test
    void findById_notFound_throws404() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, userId))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> svc.findById(userId, metricId))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findById_wrongOwner_throws404() {
        UUID otherUserId = UUID.randomUUID();
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, otherUserId))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> svc.findById(otherUserId, metricId))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---- update ----

    @Test
    void update_callsValidationAndSaves() {
        MetricUpdateRequest req = new MetricUpdateRequest(
            Map.of("kg", 75.0), OffsetDateTime.now(), "after gym");
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, userId))
            .thenReturn(Optional.of(entity));
        when(repository.save(entity)).thenReturn(entity);
        when(mapper.toResponse(entity)).thenReturn(response);

        svc.update(userId, metricId, req);

        verify(validationService).validate(MetricType.WEIGHT, Map.of("kg", 75.0));
        verify(repository).save(entity);
        assertThat(entity.getNotes()).isEqualTo("after gym");
    }

    @Test
    void update_wrongOwner_throws404() {
        UUID other = UUID.randomUUID();
        MetricUpdateRequest req = new MetricUpdateRequest(
            Map.of("kg", 75.0), OffsetDateTime.now(), null);
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, other))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> svc.update(other, metricId, req))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---- delete (soft) ----

    @Test
    void delete_setsDeletedAt() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, userId))
            .thenReturn(Optional.of(entity));
        when(repository.save(entity)).thenReturn(entity);

        svc.delete(userId, metricId);

        verify(repository).save(entity);
        assertThat(entity.getDeletedAt()).isNotNull();
    }

    @Test
    void delete_wrongOwner_throws404() {
        UUID other = UUID.randomUUID();
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(metricId, other))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> svc.delete(other, metricId))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---- findAll ----

    @Test
    @SuppressWarnings("unchecked")
    void findAll_returnsPageResponse() {
        Page<HealthMetric> page = new PageImpl<>(List.of(entity));
        when(repository.findAll(any(Specification.class), any(PageRequest.class)))
            .thenReturn(page);
        when(mapper.toResponse(entity)).thenReturn(response);

        PageResponse<MetricResponse> result = svc.findAll(userId, null, null, null,
            PageRequest.of(0, 20));

        assertThat(result.content()).hasSize(1);
        assertThat(result.totalElements()).isEqualTo(1);
    }
}
