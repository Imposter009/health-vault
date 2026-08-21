package com.healthvault.ingestion.extractor;

import java.util.List;

/** Strategy for extracting one category of health metric from raw OCR text. */
public interface MetricExtractor {

    /**
     * Scan {@code text} and return all structured matches found.
     * Returns an empty list (never null) when no matches are found.
     */
    List<ExtractionMatch> extract(String text);
}
