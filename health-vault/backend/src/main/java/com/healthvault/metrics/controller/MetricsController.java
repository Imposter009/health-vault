package com.healthvault.metrics.controller;

import com.healthvault.metrics.DashboardGranularity;
import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.dto.DashboardResponse;
import com.healthvault.metrics.dto.MetricRequest;
import com.healthvault.metrics.dto.MetricResponse;
import com.healthvault.metrics.dto.MetricUpdateRequest;
import com.healthvault.metrics.dto.PageResponse;
import com.healthvault.metrics.service.DashboardService;
import com.healthvault.metrics.service.HealthMetricService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/metrics")
@RequiredArgsConstructor
public class MetricsController {

    private final HealthMetricService metricService;
    private final DashboardService    dashboardService;

    // GET /api/metrics/dashboard — must appear before /{id} to avoid confusion
    @GetMapping("/dashboard")
    public DashboardResponse dashboard(
            Authentication auth,
            @RequestParam MetricType metricType,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "DAY") DashboardGranularity granularity) {
        UUID userId = userId(auth);
        return dashboardService.getDashboard(userId, metricType, from, to, granularity);
    }

    // POST /api/metrics
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MetricResponse create(Authentication auth, @Valid @RequestBody MetricRequest req) {
        return metricService.create(userId(auth), req);
    }

    // GET /api/metrics
    @GetMapping
    public PageResponse<MetricResponse> list(
            Authentication auth,
            @RequestParam(required = false) MetricType metricType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "recordedAt"));
        return metricService.findAll(userId(auth), metricType, from, to, pr);
    }

    // GET /api/metrics/{id}
    @GetMapping("/{id}")
    public MetricResponse getById(Authentication auth, @PathVariable UUID id) {
        return metricService.findById(userId(auth), id);
    }

    // PUT /api/metrics/{id}
    @PutMapping("/{id}")
    public MetricResponse update(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody MetricUpdateRequest req) {
        return metricService.update(userId(auth), id, req);
    }

    // DELETE /api/metrics/{id}
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable UUID id) {
        metricService.delete(userId(auth), id);
    }

    // -------------------------------------------------------------------------

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
