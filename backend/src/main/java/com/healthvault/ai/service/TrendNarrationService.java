package com.healthvault.ai.service;

import com.healthvault.ai.config.AiProperties;
import com.healthvault.ai.dto.NarrationResponse;
import com.healthvault.ai.entity.AiInteractionType;
import com.healthvault.ai.util.TrendAnalyzer;
import com.healthvault.metrics.DashboardGranularity;
import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.dto.DashboardBucketResponse;
import com.healthvault.metrics.dto.DashboardResponse;
import com.healthvault.metrics.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class TrendNarrationService {

    private static final String SYSTEM_PROMPT = """
            You are a supportive health assistant summarising a patient's health metric trends.
            You will be given a metric type, direction of change, percentage change, and the
            mean value over the measured period.

            Guidelines:
            - Describe the trend in plain English the patient can understand.
            - Be factual and neutral — neither alarming nor dismissive.
            - Keep the narration under 100 words.
            - Do NOT give medical advice or diagnoses.
            - End with: "Always discuss significant health changes with your doctor."
            """;

    private final ChatModel       chatModel;
    private final DashboardService dashboardService;
    private final AiInteractionLogger logger;
    private final AiProperties    props;

    /**
     * Fetches 12 weeks of weekly dashboard data for the most common numeric metric types,
     * runs TrendAnalyzer deterministically, and — only if a trend exists — calls the LLM
     * to produce a human-readable narration.
     *
     * Cached per userId for 1 hour (TTL configured in application.yml CacheManager).
     * The LLM call happens only when hasTrend=true; deterministic metrics that show
     * no trend return immediately without an API call.
     */
    @Cacheable(value = "ai-trend", key = "#userId + ':' + #metricType.name()")
    public NarrationResponse narrate(UUID userId, MetricType metricType) {
        OffsetDateTime to   = OffsetDateTime.now();
        OffsetDateTime from = to.minusWeeks(12);

        DashboardResponse dashboard;
        try {
            dashboard = dashboardService.getDashboard(userId, metricType, from, to, DashboardGranularity.WEEK);
        } catch (Exception e) {
            log.warn("Failed to load dashboard data for trend narration user={} type={}: {}", userId, metricType, e.getMessage());
            return new NarrationResponse(false, "Unable to load metric data at this time.", null, 0.0, false);
        }

        List<Double> values = dashboard.buckets().stream()
                .map(DashboardBucketResponse::avg)
                .filter(v -> v != null)
                .toList();

        TrendAnalyzer.TrendResult trend = TrendAnalyzer.analyse(values, props.trendSlopeThreshold());

        if (!trend.hasTrend()) {
            return new NarrationResponse(false,
                    "Not enough data or no significant trend detected for " + metricType.name().toLowerCase().replace('_', ' ') + " over the past 12 weeks.",
                    null, trend.percentChange(), false);
        }

        // Trend detected — narrate with LLM
        String userContent = """
                Metric: %s
                Direction: %s
                Percentage change over 12 weeks: %.1f%%
                Mean value: %.2f
                """.formatted(
                    metricType.name().replace('_', ' '),
                    trend.direction(),
                    trend.percentChange(),
                    trend.mean());

        Prompt prompt = new Prompt(List.of(
                new SystemMessage(SYSTEM_PROMPT),
                new UserMessage(userContent)));

        String narration = chatModel.call(prompt).getResult().getOutput().getText();

        int promptTokensApprox     = (SYSTEM_PROMPT.length() + userContent.length()) / 4;
        int completionTokensApprox = narration.length() / 4;
        logger.log(userId, AiInteractionType.TREND_NARRATION, null, promptTokensApprox, completionTokensApprox);

        return new NarrationResponse(true, narration, trend.direction(), trend.percentChange(), false);
    }
}
