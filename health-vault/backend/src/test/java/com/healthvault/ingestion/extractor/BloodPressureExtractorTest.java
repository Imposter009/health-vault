package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BloodPressureExtractorTest {

    private final BloodPressureExtractor extractor = new BloodPressureExtractor();

    @Test
    void labelled_pattern_extracts_values() {
        List<ExtractionMatch> matches = extractor.extract("Blood Pressure: 120/80 mmHg");
        assertThat(matches).hasSize(1);
        ExtractionMatch m = matches.get(0);
        assertThat(m.metricType()).isEqualTo(MetricType.BLOOD_PRESSURE);
        assertThat(m.value()).containsEntry("systolic", 120.0).containsEntry("diastolic", 80.0);
    }

    @Test
    void bp_abbreviation_accepted() {
        List<ExtractionMatch> matches = extractor.extract("BP: 130/85");
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).value()).containsEntry("systolic", 130.0);
    }

    @Test
    void standalone_with_unit_accepted() {
        List<ExtractionMatch> matches = extractor.extract("Reading today: 118/76 mmHg");
        assertThat(matches).hasSize(1);
    }

    @Test
    void inverted_values_rejected() {
        // diastolic >= systolic — should be filtered before validator
        List<ExtractionMatch> matches = extractor.extract("BP: 80/120");
        assertThat(matches).isEmpty();
    }

    @Test
    void out_of_range_rejected() {
        List<ExtractionMatch> matches = extractor.extract("BP: 400/200");
        assertThat(matches).isEmpty();
    }

    @Test
    void noisy_ocr_no_match() {
        List<ExtractionMatch> matches = extractor.extract("Patient ID: 0042  DOB: 1980/01/15  Notes: normal.");
        assertThat(matches).isEmpty();
    }
}
