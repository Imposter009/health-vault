package com.healthvault.ingestion.extractor;

import com.healthvault.metrics.MetricType;

import java.util.Map;

/**
 * A single structured value extracted from OCR text.
 *
 * @param metricType the Health Vault metric type
 * @param value      the value map in the exact shape MetricValidationService.validate() expects
 * @param rawMatch   the raw substring from the OCR text that triggered this match (for audit/debug)
 */
public record ExtractionMatch(MetricType metricType, Map<String, Object> value, String rawMatch) {}
