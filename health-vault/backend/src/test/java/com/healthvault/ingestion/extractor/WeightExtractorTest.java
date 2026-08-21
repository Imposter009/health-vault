package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WeightExtractorTest {

    private final WeightExtractor extractor = new WeightExtractor();

    @Test
    void kg_extracted_directly() {
        List<ExtractionMatch> matches = extractor.extract("Weight: 75 kg");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).metricType()).isEqualTo(MetricType.WEIGHT);
        assertThat(matches.get(0).value()).containsEntry("kg", 75.0);
    }

    @Test
    void lbs_converted_to_kg() {
        // 165 lbs * 0.453592 = 74.84268 → rounds to 74.8
        List<ExtractionMatch> matches = extractor.extract("Weight: 165 lbs");
        assertThat(matches).hasSize(1);
        double kg = (double) matches.get(0).value().get("kg");
        assertThat(kg).isBetween(74.0, 76.0);
    }

    @Test
    void decimal_kg_accepted() {
        List<ExtractionMatch> matches = extractor.extract("Body Weight: 68.5 kg");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).value()).containsEntry("kg", 68.5);
    }

    @Test
    void out_of_range_rejected() {
        List<ExtractionMatch> matches = extractor.extract("Weight: 600 kg");
        assertThat(matches).isEmpty();
    }

    @Test
    void noisy_ocr_no_match() {
        List<ExtractionMatch> matches = extractor.extract("BMI 22.4  Height 5ft 8in  Age 34");
        assertThat(matches).isEmpty();
    }
}
