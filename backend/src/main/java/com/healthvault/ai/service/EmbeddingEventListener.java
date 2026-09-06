package com.healthvault.ai.service;

import com.healthvault.common.EncryptionService;
import com.healthvault.ingestion.entity.DocumentExtraction;
import com.healthvault.ingestion.event.DocumentIngestionCompletedEvent;
import com.healthvault.ingestion.repository.DocumentExtractionRepository;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class EmbeddingEventListener {

    private final DocumentExtractionRepository extractionRepo;
    private final EncryptionService            encryptionService;
    private final EmbeddingService             embeddingService;

    /**
     * Triggered after the ingestion transaction commits for a PROCESSED document.
     * Runs in a separate thread (via @Async) so a slow/failing embedding never
     * blocks or rolls back the OCR pipeline transaction.
     *
     * When AI is disabled this bean does not exist, so the published event is a
     * no-op — core ingestion always succeeds regardless of AI feature state.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onIngestionCompleted(DocumentIngestionCompletedEvent event) {
        log.debug("EmbeddingEventListener: received for document {}", event.documentId());

        try {
            List<DocumentExtraction> extractions =
                    extractionRepo.findByDocumentId(event.documentId());
            if (extractions.isEmpty()) {
                log.warn("No extraction found for document {} — skipping embedding", event.documentId());
                return;
            }
            DocumentExtraction extraction = extractions.get(0);
            if (extraction.getExtractedTextEncrypted() == null) {
                log.info("Document {} has no extracted text — skipping embedding", event.documentId());
                return;
            }

            String plainText;
            try {
                plainText = encryptionService.decrypt(extraction.getExtractedTextEncrypted());
            } catch (Exception e) {
                log.error("Failed to decrypt OCR text for document {}: {}", event.documentId(), e.getMessage());
                return;
            }

            embeddingService.embedDocument(event.documentId(), event.userId(), plainText);

        } catch (Exception e) {
            // Fail-open: embedding failure must never surface as an error to the user
            log.error("Embedding pipeline failed for document {}: {}", event.documentId(), e.getMessage(), e);
        }
    }
}
