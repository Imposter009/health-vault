package com.healthvault.ai.controller;

import com.healthvault.ai.dto.NarrationResponse;
import com.healthvault.ai.service.TrendNarrationService;
import com.healthvault.metrics.MetricType;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai/metrics")
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AiMetricsController {

    private final TrendNarrationService narrationService;

    @GetMapping("/trend/{metricType}")
    public NarrationResponse trend(
            @PathVariable MetricType metricType,
            Authentication auth) {

        return narrationService.narrate(UUID.fromString(auth.getName()), metricType);
    }
}
