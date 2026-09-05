package com.healthvault.ingestion.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.ingestion.service.IngestionService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentUploadedConsumerTest {

    @Mock  IngestionService ingestionService;
    @Spy   SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    // Real ObjectMapper — JSON parsing is behaviour under test.
    DocumentUploadedConsumer consumer;

    UUID docId  = UUID.randomUUID();
    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        consumer = new DocumentUploadedConsumer(ingestionService, new ObjectMapper(), meterRegistry);
    }

    private String validMessage() {
        return "{\"documentId\":\"" + docId + "\",\"userId\":\"" + userId + "\"}";
    }

    // ── Happy path ────────────────────────────────────────────────────────

    @Test
    void valid_message_delegates_to_ingestion_service() {
        consumer.onDocumentUploaded(validMessage());
        verify(ingestionService).process(new DocumentUploadedEvent(docId, userId));
    }

    @Test
    void success_increments_PROCESSED_counter() {
        consumer.onDocumentUploaded(validMessage());
        double cnt = meterRegistry.counter("documents.processed.count", "status", "PROCESSED").count();
        assertThat(cnt).isEqualTo(1.0);
    }

    @Test
    void success_records_processing_duration_timer() {
        consumer.onDocumentUploaded(validMessage());
        assertThat(meterRegistry.find("documents.processing.duration").timer()).isNotNull();
        assertThat(meterRegistry.find("documents.processing.duration").timer().count()).isEqualTo(1L);
    }

    // ── Deserialization failure ───────────────────────────────────────────

    @Test
    void invalid_json_does_not_call_ingestion_service() {
        consumer.onDocumentUploaded("not-valid-json");
        verifyNoInteractions(ingestionService);
    }

    @Test
    void invalid_json_does_not_throw() {
        assertThatCode(() -> consumer.onDocumentUploaded("{bad json}"))
                .doesNotThrowAnyException();
    }

    @Test
    void invalid_json_does_not_increment_counter() {
        consumer.onDocumentUploaded("not-valid-json");
        // The counter must not have been registered at all.
        assertThat(meterRegistry.find("documents.processed.count").counter()).isNull();
    }

    // ── Processing exception ──────────────────────────────────────────────

    @Test
    void processing_exception_increments_FAILED_counter() {
        doThrow(new RuntimeException("disk full")).when(ingestionService).process(any());
        consumer.onDocumentUploaded(validMessage());
        double cnt = meterRegistry.counter("documents.processed.count", "status", "FAILED").count();
        assertThat(cnt).isEqualTo(1.0);
    }

    @Test
    void processing_exception_does_not_propagate() {
        doThrow(new RuntimeException("unexpected")).when(ingestionService).process(any());
        assertThatCode(() -> consumer.onDocumentUploaded(validMessage()))
                .doesNotThrowAnyException();
    }

    @Test
    void processing_exception_still_records_duration_timer() {
        doThrow(new RuntimeException("io error")).when(ingestionService).process(any());
        consumer.onDocumentUploaded(validMessage());
        assertThat(meterRegistry.find("documents.processing.duration").timer().count()).isEqualTo(1L);
    }
}
