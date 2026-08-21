package com.healthvault.ingestion.service;

import com.healthvault.common.EncryptionService;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.config.MinioProperties;
import com.healthvault.documents.entity.Document;
import com.healthvault.documents.repository.DocumentRepository;
import com.healthvault.ingestion.entity.DocumentExtraction;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.ingestion.extractor.ExtractionMatch;
import com.healthvault.ingestion.repository.DocumentExtractionRepository;
import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.entity.HealthMetric;
import com.healthvault.metrics.repository.HealthMetricRepository;
import com.healthvault.metrics.service.MetricValidationService;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestionServiceTest {

    @Mock DocumentRepository            documentRepository;
    @Mock DocumentExtractionRepository  extractionRepository;
    @Mock HealthMetricRepository        metricRepository;
    @Mock MetricValidationService       validationService;
    @Mock MetricExtractionService       extractionService;
    @Mock OcrService                    ocrService;
    @Mock EncryptionService             encryptionService;
    @Mock MinioClient                   minioClient;
    @Mock KafkaTemplate<String, Object> kafkaTemplate;
    @Mock MinioProperties               minioProps;
    @Mock GetObjectResponse             mockStream;    // MinIO's InputStream subclass

    IngestionService service;

    UUID docId  = UUID.randomUUID();
    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new IngestionService(
            documentRepository, extractionRepository, metricRepository,
            validationService, extractionService, ocrService,
            encryptionService, minioClient, kafkaTemplate, minioProps);
    }

    private Document uploadedDoc() {
        return Document.builder()
            .id(docId).userId(userId)
            .storageKey("key/file.pdf")
            .status(DocumentStatus.UPLOADED)
            .uploadedAt(OffsetDateTime.now())
            .metricsExtractedCount(0)
            .build();
    }

    @Test
    void happy_path_extracted_metrics_persisted() throws Exception {
        Document doc = uploadedDoc();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any())).thenReturn(doc);
        when(minioProps.bucketName()).thenReturn("bucket");
        when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(mockStream);
        when(ocrService.extractText(any(InputStream.class), anyString()))
            .thenReturn("Blood Pressure: 120/80");
        when(extractionService.extract("Blood Pressure: 120/80"))
            .thenReturn(List.of(new ExtractionMatch(MetricType.BLOOD_PRESSURE,
                Map.of("systolic", 120.0, "diastolic", 80.0), "Blood Pressure: 120/80")));
        when(metricRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(encryptionService.encrypt(anyString())).thenReturn(new byte[]{1, 2, 3});

        service.process(new DocumentUploadedEvent(docId, userId));

        // Document saved twice: once to PROCESSING, once to PROCESSED
        ArgumentCaptor<Document> docCaptor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository, times(2)).save(docCaptor.capture());
        Document finalDoc = docCaptor.getAllValues().get(1);
        assertThat(finalDoc.getStatus()).isEqualTo(DocumentStatus.PROCESSED);
        assertThat(finalDoc.getMetricsExtractedCount()).isEqualTo(1);
        assertThat(finalDoc.getProcessedAt()).isNotNull();

        // HealthMetric saved with correct type
        ArgumentCaptor<HealthMetric> metricCaptor = ArgumentCaptor.forClass(HealthMetric.class);
        verify(metricRepository).save(metricCaptor.capture());
        assertThat(metricCaptor.getValue().getMetricType()).isEqualTo(MetricType.BLOOD_PRESSURE);

        // Extraction audit record saved
        verify(extractionRepository).save(any(DocumentExtraction.class));
    }

    @Test
    void no_patterns_found_yields_processed_not_failed() throws Exception {
        Document doc = uploadedDoc();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any())).thenReturn(doc);
        when(minioProps.bucketName()).thenReturn("bucket");
        when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(mockStream);
        when(ocrService.extractText(any(InputStream.class), anyString())).thenReturn("No health data here.");
        when(extractionService.extract(anyString())).thenReturn(List.of());
        when(encryptionService.encrypt(anyString())).thenReturn(new byte[]{1});

        service.process(new DocumentUploadedEvent(docId, userId));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues().get(1).getStatus()).isEqualTo(DocumentStatus.PROCESSED);
        assertThat(captor.getAllValues().get(1).getMetricsExtractedCount()).isEqualTo(0);
        verify(metricRepository, never()).save(any());
    }

    @Test
    void ocr_failure_marks_document_failed() throws Exception {
        Document doc = uploadedDoc();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any())).thenReturn(doc);
        when(minioProps.bucketName()).thenReturn("bucket");
        when(minioClient.getObject(any(GetObjectArgs.class))).thenThrow(new RuntimeException("MinIO unreachable"));

        service.process(new DocumentUploadedEvent(docId, userId));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository, times(2)).save(captor.capture());
        Document finalDoc = captor.getAllValues().get(1);
        assertThat(finalDoc.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(finalDoc.getProcessingError()).contains("MinIO unreachable");
    }

    @Test
    void idempotent_skip_when_already_processed() {
        Document doc = uploadedDoc();
        doc.setStatus(DocumentStatus.PROCESSED);
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));

        service.process(new DocumentUploadedEvent(docId, userId));

        verify(documentRepository, never()).save(any());
        verifyNoInteractions(minioClient, ocrService, metricRepository);
    }

    @Test
    void idempotent_skip_when_already_failed() {
        Document doc = uploadedDoc();
        doc.setStatus(DocumentStatus.FAILED);
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));

        service.process(new DocumentUploadedEvent(docId, userId));

        verify(documentRepository, never()).save(any());
        verifyNoInteractions(minioClient, ocrService);
    }

    @Test
    void invalid_metric_match_skipped_but_document_processed() throws Exception {
        Document doc = uploadedDoc();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(any())).thenReturn(doc);
        when(minioProps.bucketName()).thenReturn("bucket");
        when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(mockStream);
        when(ocrService.extractText(any(InputStream.class), anyString())).thenReturn("HR 999");
        when(extractionService.extract(anyString()))
            .thenReturn(List.of(new ExtractionMatch(MetricType.HEART_RATE, Map.of("bpm", 999.0), "HR 999")));
        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "bpm out of range"))
            .when(validationService).validate(any(), any());
        when(encryptionService.encrypt(anyString())).thenReturn(new byte[]{1});

        service.process(new DocumentUploadedEvent(docId, userId));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository, times(2)).save(captor.capture());
        // Bad match is logged, not a fatal failure — document still reaches PROCESSED
        assertThat(captor.getAllValues().get(1).getStatus()).isEqualTo(DocumentStatus.PROCESSED);
        assertThat(captor.getAllValues().get(1).getMetricsExtractedCount()).isEqualTo(0);
    }
}
