package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts heart rate readings.
 *
 * Recognised patterns (case-insensitive):
 *   "Heart Rate: 72 bpm"
 *   "HR: 65 bpm"
 *   "Pulse: 78 BPM"
 *   "Pulse Rate: 80"
 *
 * MetricValidationService.validate(HEART_RATE, …) expects: {bpm: double}
 */
@Component
public class HeartRateExtractor implements MetricExtractor {

    private static final Pattern PATTERN = Pattern.compile(
        "(?i)(?:heart\\s+rate|hr|pulse(?:\\s+rate)?)\\s*[:\\-]?\\s*(\\d{2,3})\\s*(?:bpm|b/min)?");

    @Override
    public List<ExtractionMatch> extract(String text) {
        List<ExtractionMatch> results = new ArrayList<>();
        Matcher m = PATTERN.matcher(text);
        while (m.find()) {
            double bpm = Double.parseDouble(m.group(1));
            if (bpm < 20 || bpm > 300) continue;
            results.add(new ExtractionMatch(
                MetricType.HEART_RATE,
                Map.of("bpm", bpm),
                m.group()
            ));
        }
        return results;
    }
}
