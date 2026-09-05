package com.healthvault.ingestion.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.ingestion.service.IngestionService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DocumentUploadedConsumer {

    private final IngestionService ingestionService;
    private final ObjectMapper     objectMapper;
    private final MeterRegistry    meterRegistry;

    @KafkaListener(topics = "document.uploaded", groupId = "health-vault-ingestion")
    public void onDocumentUploaded(String message) {
        DocumentUploadedEvent event;
        try {
            event = objectMapper.readValue(message, DocumentUploadedEvent.class);
        } catch (Exception e) {
            log.error("Failed to deserialize DocumentUploadedEvent: {} — message: {}", e.getMessage(), message);
            return;
        }
        log.info("Received document.uploaded event for document {}", event.documentId());

        // Timer covers the full pipeline: from message consumed to processing complete.
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "PROCESSED";
        try {
            ingestionService.process(event);
        } catch (Exception e) {
            // Catch-all so the consumer thread doesn't die and leave the partition unread.
            // The document status will remain PROCESSING; a monitoring alert should fire.
            log.error("Unhandled exception processing document {}: {}", event.documentId(), e.getMessage(), e);
            outcome = "FAILED";
        } finally {
            sample.stop(Timer.builder("documents.processing.duration")
                    .description("Time from document.uploaded consumed to processing complete")
                    .register(meterRegistry));
            Counter.builder("documents.processed.count")
                    .tag("status", outcome)
                    .description("Documents processed by the ingestion pipeline, tagged by outcome")
                    .register(meterRegistry)
                    .increment();
        }
    }
}
