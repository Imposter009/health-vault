package com.healthvault.metrics.service;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

class MetricValidationServiceTest {

    private MetricValidationService svc;

    @BeforeEach
    void setUp() { svc = new MetricValidationService(); }

    // ---- BLOOD_PRESSURE ----

    @Test
    void bloodPressure_valid() {
        assertThatCode(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 120, "diastolic", 80))).doesNotThrowAnyException();
    }

    @Test
    void bloodPressure_systolicTooLow() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 50, "diastolic", 40)));
    }

    @Test
    void bloodPressure_systolicTooHigh() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 400, "diastolic", 80)));
    }

    @Test
    void bloodPressure_diastolicTooLow() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 120, "diastolic", 30)));
    }

    @Test
    void bloodPressure_diastolicHigherThanSystolic() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 80, "diastolic", 100)));
    }

    @Test
    void bloodPressure_diastolicEqualToSystolic() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 100, "diastolic", 100)));
    }

    @Test
    void bloodPressure_missingField() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_PRESSURE,
            Map.of("systolic", 120)));
    }

    // ---- BLOOD_SUGAR ----

    @Test
    void bloodSugar_validFasting() {
        assertThatCode(() -> svc.validate(MetricType.BLOOD_SUGAR,
            Map.of("mgPerDl", 90, "context", "FASTING"))).doesNotThrowAnyException();
    }

    @Test
    void bloodSugar_validPostMeal() {
        assertThatCode(() -> svc.validate(MetricType.BLOOD_SUGAR,
            Map.of("mgPerDl", 140, "context", "POST_MEAL"))).doesNotThrowAnyException();
    }

    @Test
    void bloodSugar_mgTooLow() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_SUGAR,
            Map.of("mgPerDl", 5, "context", "RANDOM")));
    }

    @Test
    void bloodSugar_mgTooHigh() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_SUGAR,
            Map.of("mgPerDl", 1500, "context", "RANDOM")));
    }

    @Test
    void bloodSugar_invalidContext() {
        assertBadRequest(() -> svc.validate(MetricType.BLOOD_SUGAR,
            Map.of("mgPerDl", 100, "context", "LUNCH")));
    }

    // ---- WEIGHT ----

    @Test
    void weight_valid() {
        assertThatCode(() -> svc.validate(MetricType.WEIGHT,
            Map.of("kg", 72.5))).doesNotThrowAnyException();
    }

    @Test
    void weight_tooLow() {
        assertBadRequest(() -> svc.validate(MetricType.WEIGHT, Map.of("kg", 0)));
    }

    @Test
    void weight_tooHigh() {
        assertBadRequest(() -> svc.validate(MetricType.WEIGHT, Map.of("kg", 600)));
    }

    @Test
    void weight_missingKg() {
        assertBadRequest(() -> svc.validate(MetricType.WEIGHT, Map.of("pounds", 160)));
    }

    // ---- WORKOUT ----

    @Test
    void workout_valid() {
        assertThatCode(() -> svc.validate(MetricType.WORKOUT,
            Map.of("type", "RUNNING", "durationMinutes", 30, "intensity", "MODERATE")))
            .doesNotThrowAnyException();
    }

    @Test
    void workout_durationTooLow() {
        assertBadRequest(() -> svc.validate(MetricType.WORKOUT,
            Map.of("type", "CYCLING", "durationMinutes", 0, "intensity", "LOW")));
    }

    @Test
    void workout_durationTooHigh() {
        assertBadRequest(() -> svc.validate(MetricType.WORKOUT,
            Map.of("type", "CYCLING", "durationMinutes", 700, "intensity", "LOW")));
    }

    @Test
    void workout_invalidIntensity() {
        assertBadRequest(() -> svc.validate(MetricType.WORKOUT,
            Map.of("type", "YOGA", "durationMinutes", 45, "intensity", "EXTREME")));
    }

    @Test
    void workout_missingType() {
        assertBadRequest(() -> svc.validate(MetricType.WORKOUT,
            Map.of("durationMinutes", 30, "intensity", "LOW")));
    }

    // ---- HEART_RATE ----

    @Test
    void heartRate_valid() {
        assertThatCode(() -> svc.validate(MetricType.HEART_RATE,
            Map.of("bpm", 68))).doesNotThrowAnyException();
    }

    @Test
    void heartRate_tooLow() {
        assertBadRequest(() -> svc.validate(MetricType.HEART_RATE, Map.of("bpm", 10)));
    }

    @Test
    void heartRate_tooHigh() {
        assertBadRequest(() -> svc.validate(MetricType.HEART_RATE, Map.of("bpm", 400)));
    }

    @Test
    void heartRate_notANumber() {
        assertBadRequest(() -> svc.validate(MetricType.HEART_RATE, Map.of("bpm", "fast")));
    }

    // ---- helper ----

    private void assertBadRequest(ThrowingRunnable r) {
        assertThatThrownBy(r::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(ex -> {
                ResponseStatusException rse = (ResponseStatusException) ex;
                org.assertj.core.api.Assertions.assertThat(rse.getStatusCode()).isEqualTo(BAD_REQUEST);
            });
    }

    @FunctionalInterface
    interface ThrowingRunnable { void run(); }
}
