package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BloodSugarExtractorTest {

    private final BloodSugarExtractor extractor = new BloodSugarExtractor();

    @Test
    void mg_dl_extraction() {
        List<ExtractionMatch> matches = extractor.extract("Blood Sugar: 110 mg/dL");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).metricType()).isEqualTo(MetricType.BLOOD_SUGAR);
        assertThat(matches.get(0).value()).containsEntry("mgPerDl", 110.0).containsEntry("context", "RANDOM");
    }

    @Test
    void fasting_context_detected() {
        List<ExtractionMatch> matches = extractor.extract("Fasting Blood Sugar: 88 mg/dL");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).value()).containsEntry("context", "FASTING");
    }

    @Test
    void mmol_converted_to_mg_dl() {
        // 5.5 mmol/L * 18.0182 ≈ 99.1 mg/dL
        List<ExtractionMatch> matches = extractor.extract("Blood Glucose: 5.5 mmol/L");
        assertThat(matches).hasSize(1);
        double mgPerDl = (double) matches.get(0).value().get("mgPerDl");
        assertThat(mgPerDl).isBetween(98.0, 101.0);
    }

    @Test
    void out_of_range_rejected() {
        List<ExtractionMatch> matches = extractor.extract("Glucose: 2000 mg/dL");
        assertThat(matches).isEmpty();
    }

    @Test
    void noisy_ocr_no_match() {
        List<ExtractionMatch> matches = extractor.extract("Ref: 0042 — all results within normal limits. See attached.");
        assertThat(matches).isEmpty();
    }
}
