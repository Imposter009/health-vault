package com.healthvault.metrics.service;

import com.healthvault.metrics.MetricType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;

@Service
public class MetricValidationService {

    public void validate(MetricType type, Map<String, Object> value) {
        switch (type) {
            case BLOOD_PRESSURE -> validateBloodPressure(value);
            case BLOOD_SUGAR    -> validateBloodSugar(value);
            case WEIGHT         -> validateWeight(value);
            case WORKOUT        -> validateWorkout(value);
            case HEART_RATE     -> validateHeartRate(value);
        }
    }

    // ---- per-type validators ------------------------------------------------

    private void validateBloodPressure(Map<String, Object> v) {
        double systolic  = requireDouble(v, "systolic",  "BLOOD_PRESSURE");
        double diastolic = requireDouble(v, "diastolic", "BLOOD_PRESSURE");
        if (systolic  < 60  || systolic  > 300) reject("BLOOD_PRESSURE.systolic must be between 60 and 300");
        if (diastolic < 40  || diastolic > 200) reject("BLOOD_PRESSURE.diastolic must be between 40 and 200");
        if (diastolic >= systolic) reject("BLOOD_PRESSURE.diastolic must be less than systolic");
    }

    private void validateBloodSugar(Map<String, Object> v) {
        double mgPerDl = requireDouble(v, "mgPerDl", "BLOOD_SUGAR");
        if (mgPerDl < 10 || mgPerDl > 1000) reject("BLOOD_SUGAR.mgPerDl must be between 10 and 1000");
        String ctx = requireString(v, "context", "BLOOD_SUGAR");
        if (!Set.of("FASTING", "POST_MEAL", "RANDOM").contains(ctx))
            reject("BLOOD_SUGAR.context must be one of FASTING, POST_MEAL, RANDOM");
    }

    private void validateWeight(Map<String, Object> v) {
        double kg = requireDouble(v, "kg", "WEIGHT");
        if (kg < 1 || kg > 500) reject("WEIGHT.kg must be between 1 and 500");
    }

    private void validateWorkout(Map<String, Object> v) {
        requireString(v, "type", "WORKOUT");
        double dur = requireDouble(v, "durationMinutes", "WORKOUT");
        if (dur < 1 || dur > 600) reject("WORKOUT.durationMinutes must be between 1 and 600");
        String intensity = requireString(v, "intensity", "WORKOUT");
        if (!Set.of("LOW", "MODERATE", "HIGH").contains(intensity))
            reject("WORKOUT.intensity must be one of LOW, MODERATE, HIGH");
    }

    private void validateHeartRate(Map<String, Object> v) {
        double bpm = requireDouble(v, "bpm", "HEART_RATE");
        if (bpm < 20 || bpm > 300) reject("HEART_RATE.bpm must be between 20 and 300");
    }

    // ---- helpers ------------------------------------------------------------

    // Package-visible so unit tests can exercise individual helpers.
    double requireDouble(Map<String, Object> map, String field, String prefix) {
        Object val = map.get(field);
        if (val == null) reject(prefix + "." + field + " is required");
        if (!(val instanceof Number)) reject(prefix + "." + field + " must be a number");
        return ((Number) val).doubleValue();
    }

    String requireString(Map<String, Object> map, String field, String prefix) {
        Object val = map.get(field);
        if (!(val instanceof String s) || s.isBlank())
            reject(prefix + "." + field + " is required and must be a non-empty string");
        return (String) val;
    }

    private void reject(String message) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
