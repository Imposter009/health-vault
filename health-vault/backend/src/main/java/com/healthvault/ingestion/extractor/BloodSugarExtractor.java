package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts blood sugar (glucose) readings.
 *
 * Recognised patterns (case-insensitive):
 *   "Blood Sugar: 110 mg/dL"
 *   "Blood Glucose: 5.6 mmol/L"  → converted to mg/dL (* 18.0182)
 *   "Glucose 95"  (assumed mg/dL)
 *   "Fasting Blood Sugar: 88"    → context=FASTING
 *
 * MetricValidationService.validate(BLOOD_SUGAR, …) expects: {mgPerDl: double, context: string}
 * context one of: FASTING, POST_MEAL, RANDOM
 */
@Component
public class BloodSugarExtractor implements MetricExtractor {

    // mg/dL form
    private static final Pattern MG_DL = Pattern.compile(
        "(?i)(?:(fasting|post[\\s_-]?meal)\\s+)?(?:blood\\s+)?(?:sugar|glucose)\\s*[:\\-]?\\s*(\\d{2,4}(?:\\.\\d+)?)\\s*(?:mg/dl|mg/dL)?");

    // mmol/L form (explicit unit required to distinguish from unrelated numbers)
    private static final Pattern MMOL = Pattern.compile(
        "(?i)(?:blood\\s+)?(?:sugar|glucose)\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)\\s*mmol/?l");

    @Override
    public List<ExtractionMatch> extract(String text) {
        List<ExtractionMatch> results = new ArrayList<>();

        Matcher mg = MG_DL.matcher(text);
        while (mg.find()) {
            double mgPerDl = Double.parseDouble(mg.group(2));
            if (mgPerDl < 10 || mgPerDl > 1000) continue;
            String ctx = deriveContext(mg.group(1));
            results.add(new ExtractionMatch(
                MetricType.BLOOD_SUGAR,
                Map.of("mgPerDl", mgPerDl, "context", ctx),
                mg.group()
            ));
        }

        Matcher mm = MMOL.matcher(text);
        while (mm.find()) {
            double mmol    = Double.parseDouble(mm.group(1));
            double mgPerDl = Math.round(mmol * 18.0182 * 10.0) / 10.0;
            if (mgPerDl < 10 || mgPerDl > 1000) continue;
            results.add(new ExtractionMatch(
                MetricType.BLOOD_SUGAR,
                Map.of("mgPerDl", mgPerDl, "context", "RANDOM"),
                mm.group()
            ));
        }

        return results;
    }

    private String deriveContext(String label) {
        if (label == null) return "RANDOM";
        String l = label.toLowerCase().replace("-", "").replace("_", "").replace(" ", "");
        if (l.contains("fasting")) return "FASTING";
        if (l.contains("postmeal")) return "POST_MEAL";
        return "RANDOM";
    }
}
