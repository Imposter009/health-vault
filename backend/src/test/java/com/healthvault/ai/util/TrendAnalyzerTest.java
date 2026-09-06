package com.healthvault.ai.util;

import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TrendAnalyzerTest {

    private static final double THRESHOLD = 0.05;

    @Test
    void nullInputReturnsNoTrend() {
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(null, THRESHOLD);
        assertFalse(result.hasTrend());
    }

    @Test
    void emptyListReturnsNoTrend() {
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(Collections.emptyList(), THRESHOLD);
        assertFalse(result.hasTrend());
    }

    @Test
    void twoPointsReturnsNoTrend() {
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(List.of(70.0, 75.0), THRESHOLD);
        assertFalse(result.hasTrend(), "Need at least 3 data points to detect a trend");
    }

    @Test
    void flatLineReturnsNoTrend() {
        List<Double> flat = List.of(70.0, 70.0, 70.0, 70.0, 70.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(flat, THRESHOLD);
        assertFalse(result.hasTrend(), "Zero slope should not qualify as a trend");
    }

    @Test
    void risingValuesTrendDetectedAsUp() {
        // [60, 65, 70, 75, 80, 85]: slope=5.0, mean=72.5, relativeSlope=6.9% > 5% threshold
        List<Double> rising = List.of(60.0, 65.0, 70.0, 75.0, 80.0, 85.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(rising, THRESHOLD);
        assertTrue(result.hasTrend());
        assertEquals("increasing", result.direction());
        assertTrue(result.percentChange() > 0);
    }

    @Test
    void fallingValuesTrendDetectedAsDown() {
        // [85, 80, 75, 70, 65, 60]: slope=-5.0, mean=72.5, relativeSlope=6.9% > 5% threshold
        // percentChange is MAGNITUDE (100 * |slope| / mean), always positive — direction uses result.direction()
        List<Double> falling = List.of(85.0, 80.0, 75.0, 70.0, 65.0, 60.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(falling, THRESHOLD);
        assertTrue(result.hasTrend());
        assertEquals("decreasing", result.direction());
        assertTrue(result.percentChange() > 0,
                "percentChange is magnitude (|slope|/mean*100), never negative — sign is in direction");
    }

    @Test
    void smallNoiseDoesNotTriggerTrend() {
        // ±0.5 variation around 70 — relative slope well below 5% threshold
        List<Double> noisy = List.of(70.0, 70.5, 69.8, 70.2, 70.1, 69.9);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(noisy, THRESHOLD);
        assertFalse(result.hasTrend(), "Random noise within 1% should not be classified as a trend");
    }

    @Test
    void meanIsCorrect() {
        List<Double> values = List.of(10.0, 20.0, 30.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(values, THRESHOLD);
        assertEquals(20.0, result.mean(), 0.001);
    }

    @Test
    void slopePerBucketIsPositiveForRising() {
        List<Double> rising = List.of(10.0, 20.0, 30.0, 40.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(rising, THRESHOLD);
        assertTrue(result.slopePerBucket() > 0);
    }

    /**
     * Explicit percent-change verification for a rising trend.
     *
     * Series: [10, 20, 30]  (n=3)
     *   sumX=3, sumY=60, sumXY=0+20+60=80, sumXX=0+1+4=5
     *   denom = 3*5 - 3*3 = 6
     *   slope = (3*80 - 3*60) / 6 = (240-180)/6 = 10.0
     *   mean  = 60/3 = 20.0
     *   percentChange = 100 * |10| / 20 = 50.0%
     */
    @Test
    void percentChangeIsCorrectForRisingSeries() {
        List<Double> values = List.of(10.0, 20.0, 30.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(values, THRESHOLD);
        assertTrue(result.hasTrend(), "relativeSlope=50% far exceeds 5% threshold");
        assertEquals("increasing", result.direction());
        assertEquals(50.0, result.percentChange(), 0.01,
                "percentChange should be 100*|slope|/mean = 100*10/20 = 50.0");
    }

    /**
     * Explicit percent-change verification for a falling trend.
     *
     * Series: [30, 20, 10]  (n=3)
     *   sumX=3, sumY=60, sumXY=0+20+20=40, sumXX=5
     *   denom=6
     *   slope = (3*40 - 3*60) / 6 = (120-180)/6 = -10.0
     *   mean  = 20.0
     *   percentChange = 100 * |-10| / 20 = 50.0  (positive — magnitude, not signed)
     */
    @Test
    void percentChangeIsMagnitudeForFallingSeries() {
        List<Double> values = List.of(30.0, 20.0, 10.0);
        TrendAnalyzer.TrendResult result = TrendAnalyzer.analyse(values, THRESHOLD);
        assertTrue(result.hasTrend(), "relativeSlope=50% far exceeds 5% threshold");
        assertEquals("decreasing", result.direction());
        assertEquals(50.0, result.percentChange(), 0.01,
                "percentChange is magnitude even for a falling trend — sign is in direction field");
    }
}
