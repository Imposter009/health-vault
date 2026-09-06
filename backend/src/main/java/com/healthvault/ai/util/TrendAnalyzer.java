package com.healthvault.ai.util;

import java.util.List;

/**
 * Deterministic trend detection for health metrics time-series data.
 *
 * Design principle: the LLM's job in trend narration is to describe a pattern
 * that this class has already detected computationally. The LLM must never be
 * asked to judge whether a trend is significant — that judgement is made here,
 * with explicit, explainable thresholds, before any LLM call happens.
 *
 * Thread-safe: stateless utility class.
 */
public final class TrendAnalyzer {

    private TrendAnalyzer() {}

    /**
     * Result of a trend analysis pass.
     *
     * @param hasTrend        true if the slope meets the significance threshold
     * @param slopePerBucket  linear-regression slope (change per time bucket)
     * @param mean            arithmetic mean of the series
     * @param direction       "increasing" | "decreasing" | "flat"
     * @param percentChange   100 * |slope| / mean (relative change per bucket)
     */
    public record TrendResult(
            boolean hasTrend,
            double  slopePerBucket,
            double  mean,
            String  direction,
            double  percentChange
    ) {}

    /**
     * Analyse a time-ordered series of numeric values.
     *
     * @param values          ordered metric values (earliest first)
     * @param slopeThreshold  minimum |slope|/mean to classify as a trend
     * @return TrendResult — never null; hasTrend=false when data is flat or too short
     */
    public static TrendResult analyse(List<Double> values, double slopeThreshold) {
        if (values == null || values.size() < 3) {
            // Not enough data points for a meaningful trend
            return new TrendResult(false, 0, 0, "flat", 0);
        }

        // Filter out nulls
        List<Double> clean = values.stream().filter(v -> v != null).toList();
        if (clean.size() < 3) {
            return new TrendResult(false, 0, 0, "flat", 0);
        }

        int    n     = clean.size();
        double sumX  = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (int i = 0; i < n; i++) {
            double x = i;          // time index (bucket number)
            double y = clean.get(i);
            sumX  += x;
            sumY  += y;
            sumXY += x * y;
            sumXX += x * x;
        }

        double denom = (n * sumXX) - (sumX * sumX);
        if (Math.abs(denom) < 1e-10) {
            // All x values identical (degenerate case — shouldn't happen)
            return new TrendResult(false, 0, sumY / n, "flat", 0);
        }

        double slope = ((n * sumXY) - (sumX * sumY)) / denom;
        double mean  = sumY / n;

        // Relative slope: fractional change per bucket relative to the mean
        double relativeSlope = mean == 0 ? 0 : Math.abs(slope) / mean;
        boolean hasTrend     = relativeSlope > slopeThreshold;

        String direction = slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "flat";
        double pctChange  = relativeSlope * 100.0;

        return new TrendResult(hasTrend, slope, mean, direction, pctChange);
    }
}
