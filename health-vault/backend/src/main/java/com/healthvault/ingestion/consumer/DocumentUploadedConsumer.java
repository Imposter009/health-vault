package com.healthvault.ingestion.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.ingestion.service.IngestionService;
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
        try {
            ingestionService.process(event);
        } catch (Exception e) {
            // Catch-all so the consumer thread doesn't die and leave the partition unread.
            // The document status will remain PROCESSING; a monitoring alert should fire.
            log.error("Unhandled exception processing document {}: {}", event.documentId(), e.getMessage(), e);
        }
    }
}
