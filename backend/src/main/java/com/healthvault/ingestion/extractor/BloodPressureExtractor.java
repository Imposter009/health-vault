package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts blood pressure readings.
 *
 * Recognised patterns (case-insensitive):
 *   "Blood Pressure: 120/80"
 *   "BP: 120/80 mmHg"
 *   "B.P. 130/85"
 *   standalone "120/80" near "mmHg"
 */
@Component
public class BloodPressureExtractor implements MetricExtractor {

    // Named-label form: "BP: 120/80" or "Blood Pressure 130/85 mmHg"
    private static final Pattern LABELLED = Pattern.compile(
        "(?i)(?:blood\\s+pressure|b\\.?p\\.?)\\s*[:\\-]?\\s*(\\d{2,3})\\s*/\\s*(\\d{2,3})",
        Pattern.CASE_INSENSITIVE);

    // Standalone "120/80 mmHg" (must have the unit to avoid false-positives on date fractions)
    private static final Pattern WITH_UNIT = Pattern.compile(
        "(\\d{2,3})\\s*/\\s*(\\d{2,3})\\s*mmhg",
        Pattern.CASE_INSENSITIVE);

    @Override
    public List<ExtractionMatch> extract(String text) {
        List<ExtractionMatch> results = new ArrayList<>();
        // Track (systolic, diastolic) pairs already added to avoid double-counting
        // when the labelled pattern and the unit-suffixed pattern both fire on the same value.
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (Pattern p : List.of(LABELLED, WITH_UNIT)) {
            Matcher m = p.matcher(text);
            while (m.find()) {
                double systolic  = Double.parseDouble(m.group(1));
                double diastolic = Double.parseDouble(m.group(2));
                if (systolic < 60 || systolic > 300 || diastolic < 40 || diastolic > 200) continue;
                if (diastolic >= systolic) continue;
                String key = systolic + "/" + diastolic;
                if (!seen.add(key)) continue;
                results.add(new ExtractionMatch(
                    MetricType.BLOOD_PRESSURE,
                    Map.of("systolic", systolic, "diastolic", diastolic),
                    m.group()
                ));
            }
        }
        return results;
    }
}
