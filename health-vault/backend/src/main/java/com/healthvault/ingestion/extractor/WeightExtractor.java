package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts weight readings.
 *
 * Recognised patterns (case-insensitive):
 *   "Weight: 75 kg"  or "Weight: 75.5 kg"
 *   "Weight: 165 lbs"  or "Weight: 165 lb"  → converted to kg (* 0.453592)
 *   "Body Weight 80 kg"
 *
 * MetricValidationService.validate(WEIGHT, …) expects: {kg: double}
 */
@Component
public class WeightExtractor implements MetricExtractor {

    private static final Pattern KG = Pattern.compile(
        "(?i)(?:body\\s+)?weight\\s*[:\\-]?\\s*(\\d{1,4}(?:\\.\\d+)?)\\s*kg");

    private static final Pattern LBS = Pattern.compile(
        "(?i)(?:body\\s+)?weight\\s*[:\\-]?\\s*(\\d{1,4}(?:\\.\\d+)?)\\s*(?:lbs?|pounds?)");

    @Override
    public List<ExtractionMatch> extract(String text) {
        List<ExtractionMatch> results = new ArrayList<>();

        Matcher kg = KG.matcher(text);
        while (kg.find()) {
            double kgVal = Double.parseDouble(kg.group(1));
            if (kgVal < 1 || kgVal > 500) continue;
            results.add(new ExtractionMatch(
                MetricType.WEIGHT,
                Map.of("kg", kgVal),
                kg.group()
            ));
        }

        Matcher lbs = LBS.matcher(text);
        while (lbs.find()) {
            double lbVal = Double.parseDouble(lbs.group(1));
            double kgVal = Math.round(lbVal * 0.453592 * 10.0) / 10.0;
            if (kgVal < 1 || kgVal > 500) continue;
            results.add(new ExtractionMatch(
                MetricType.WEIGHT,
                Map.of("kg", kgVal),
                lbs.group()
            ));
        }

        return results;
    }
}
