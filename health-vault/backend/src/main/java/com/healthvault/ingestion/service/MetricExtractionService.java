package com.healthvault.ingestion.service;

import com.healthvault.ingestion.extractor.ExtractionMatch;
import com.healthvault.ingestion.extractor.MetricExtractor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/** Runs all registered {@link MetricExtractor} strategies against OCR text. */
@Service
@RequiredArgsConstructor
public class MetricExtractionService {

    // Spring injects all MetricExtractor beans automatically (BloodPressureExtractor,
    // BloodSugarExtractor, WeightExtractor, HeartRateExtractor).
    private final List<MetricExtractor> extractors;

    /**
     * @param text raw OCR output
     * @return all matches across all extractor strategies; may be empty, never null
     */
    public List<ExtractionMatch> extract(String text) {
        return extractors.stream()
            .flatMap(e -> e.extract(text).stream())
            .collect(Collectors.toList());
    }
}
