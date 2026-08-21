package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HeartRateExtractorTest {

    private final HeartRateExtractor extractor = new HeartRateExtractor();

    @Test
    void heart_rate_label_extracted() {
        List<ExtractionMatch> matches = extractor.extract("Heart Rate: 72 bpm");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).metricType()).isEqualTo(MetricType.HEART_RATE);
        assertThat(matches.get(0).value()).containsEntry("bpm", 72.0);
    }

    @Test
    void pulse_label_extracted() {
        List<ExtractionMatch> matches = extractor.extract("Pulse: 78 BPM");
        assertThat(matches).hasSize(1);
    }

    @Test
    void hr_abbreviation_extracted() {
        List<ExtractionMatch> matches = extractor.extract("HR: 65");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).value()).containsEntry("bpm", 65.0);
    }

    @Test
    void out_of_range_rejected() {
        List<ExtractionMatch> matches = extractor.extract("Heart Rate: 10 bpm");
        assertThat(matches).isEmpty();
    }

    @Test
    void noisy_ocr_no_match() {
        List<ExtractionMatch> matches = extractor.extract("Patient born 1982, admits: occasional fatigue.");
        assertThat(matches).isEmpty();
    }
}
