package com.healthvault.ingestion.service;

import com.healthvault.common.EncryptionService;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.entity.Document;
import com.healthvault.documents.repository.DocumentRepository;
import com.healthvault.ingestion.entity.DocumentExtraction;
import com.healthvault.ingestion.event.DocumentIngestionCompletedEvent;
import com.healthvault.ingestion.event.DocumentProcessedEvent;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.ingestion.extractor.ExtractionMatch;
import com.healthvault.ingestion.repository.DocumentExtractionRepository;
import com.healthvault.metrics.MetricSource;
import com.healthvault.metrics.entity.HealthMetric;
import com.healthvault.metrics.repository.HealthMetricRepository;
import com.healthvault.metrics.service.MetricValidationService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class IngestionService {

    private final DocumentRepository           documentRepository;
    private final DocumentExtractionRepository extractionRepository;
    private final HealthMetricRepository       metricRepository;
    private final MetricValidationService      validationService;
    private final MetricExtractionService      extractionService;
    private final OcrService                   ocrService;
    private final EncryptionService            encryptionService;
    private final MinioClient                  minioClient;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ApplicationEventPublisher     eventPublisher;

    // MinIO bucket is resolved from DocumentService's MinioProperties; to avoid
    // a cross-package dependency on the properties record, read it from the document row.
    // The bucket name is embedded in the storage key's first segment only for pre-signed URLs,
    // NOT in the key itself. We need the bucket separately. Accept it as a parameter.
    // ----
    // Design note: We accepted the minor coupling to MinioProperties here to avoid threading
    // the bucket name through the Kafka event (which would expose infra detail in the message).
    private final com.healthvault.documents.config.MinioProperties minioProps;

    /**
     * Full OCR pipeline for one document.
     * Idempotent: skips documents that are already PROCESSED or FAILED.
     */
    @Transactional
    public void process(DocumentUploadedEvent event) {
        Document doc = documentRepository.findById(event.documentId()).orElse(null);
        if (doc == null) {
            log.warn("IngestionService.process: document {} not found — skipping", event.documentId());
            return;
        }

        // Idempotency guard: don't re-process if already done
        if (doc.getStatus() == DocumentStatus.PROCESSED || doc.getStatus() == DocumentStatus.FAILED) {
            log.info("Document {} already in terminal state {} — skipping", doc.getId(), doc.getStatus());
            return;
        }

        // Mark PROCESSING
        doc.setStatus(DocumentStatus.PROCESSING);
        documentRepository.save(doc);

        String ocrText = null;
        List<ExtractionMatch> matches = List.of();
        String ocrError = null;
        int savedMetrics = 0;

        try {
            // --- Download from MinIO ---
            try (InputStream stream = minioClient.getObject(
                    GetObjectArgs.builder()
                        .bucket(minioProps.bucketName())
                        .object(doc.getStorageKey())
                        .build())) {

                // --- OCR ---
                ocrText = ocrService.extractText(stream, doc.getStorageKey());
            }

            // --- Extract metric patterns ---
            if (ocrText != null && !ocrText.isBlank()) {
                matches = extractionService.extract(ocrText);
            }

            // --- Persist health metrics (one per valid match) ---
            savedMetrics = saveMetrics(doc, matches);

        } catch (Exception e) {
            log.error("OCR pipeline failed for document {}: {}", doc.getId(), e.getMessage(), e);
            ocrError = e.getClass().getSimpleName() + ": " + e.getMessage();
        }

        // --- Persist extraction audit record ---
        byte[] encryptedText = null;
        if (ocrText != null && !ocrText.isBlank()) {
            try {
                encryptedText = encryptionService.encrypt(ocrText);
            } catch (Exception e) {
                log.warn("Could not encrypt OCR text for document {}: {}", doc.getId(), e.getMessage());
            }
        }
        extractionRepository.save(DocumentExtraction.builder()
            .documentId(doc.getId())
            .extractedTextEncrypted(encryptedText)
            .extractedMetrics(matchesToJson(matches))
            .extractionError(ocrError)
            .build());

        // --- Update document final state ---
        if (ocrError != null) {
            doc.setStatus(DocumentStatus.FAILED);
            doc.setProcessingError(ocrError);
        } else {
            doc.setStatus(DocumentStatus.PROCESSED);
            doc.setProcessedAt(OffsetDateTime.now());
            doc.setMetricsExtractedCount(savedMetrics);
            // Publish after-commit event so AI embedding can trigger asynchronously.
            // If AI is disabled there is no listener and this publish is a no-op.
            eventPublisher.publishEvent(new DocumentIngestionCompletedEvent(doc.getId(), doc.getUserId()));
        }
        documentRepository.save(doc);

        // --- Publish document.processed (fail-open) ---
        String finalStatus = doc.getStatus().name();
        try {
            kafkaTemplate.send("document.processed",
                doc.getId().toString(),
                new DocumentProcessedEvent(doc.getId(), doc.getUserId(), finalStatus, savedMetrics));
        } catch (Exception e) {
            log.warn("Failed to publish document.processed for {}: {}", doc.getId(), e.getMessage());
        }

        log.info("Document {} processed: status={}, metrics={}", doc.getId(), finalStatus, savedMetrics);
    }

    /**
     * Attempts to save each match as a HealthMetric row.
     * Per-match validation failures are caught and logged — one bad extraction
     * does not abort the rest or mark the document as FAILED.
     *
     * @return count of successfully saved metrics
     */
    private int saveMetrics(Document doc, List<ExtractionMatch> matches) {
        int count = 0;
        for (ExtractionMatch match : matches) {
            try {
                // Call the validator directly (HealthMetricService.create() hardcodes MANUAL source)
                validationService.validate(match.metricType(), match.value());
                metricRepository.save(HealthMetric.builder()
                    .userId(doc.getUserId())
                    .metricType(match.metricType())
                    .value(match.value())
                    .recordedAt(doc.getUploadedAt())   // best-effort: use upload time
                    .source(MetricSource.EXTRACTED_FROM_DOCUMENT)
                    .notes("Auto-extracted from document " + doc.getId())
                    .build());
                count++;
            } catch (ResponseStatusException e) {
                // Validation rejected this match (value out of range, missing field, etc.)
                log.debug("Metric extraction match failed validation for document {}: {} — {}",
                    doc.getId(), match.rawMatch(), e.getReason());
            } catch (Exception e) {
                log.warn("Unexpected error saving metric for document {}: {}", doc.getId(), e.getMessage());
            }
        }
        return count;
    }

    /** Converts ExtractionMatch list to a List<Map> for JSONB storage. */
    private List<Map<String, Object>> matchesToJson(List<ExtractionMatch> matches) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ExtractionMatch m : matches) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("metricType", m.metricType().name());
            entry.put("value", m.value());
            entry.put("rawMatch", m.rawMatch());
            result.add(entry);
        }
        return result;
    }
}
