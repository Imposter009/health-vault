package com.healthvault.documents.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.service.AuditService;
import com.healthvault.common.EncryptionService;
import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentMapper;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.config.DocumentProperties;
import com.healthvault.documents.config.MinioProperties;
import com.healthvault.documents.dto.DocumentResponse;
import com.healthvault.documents.dto.DocumentStatusResponse;
import com.healthvault.documents.dto.DownloadUrlResponse;
import com.healthvault.documents.entity.Document;
import com.healthvault.documents.repository.DocumentRepository;
import com.healthvault.documents.repository.DocumentSpecifications;
import com.healthvault.ingestion.event.DocumentUploadedEvent;
import com.healthvault.metrics.dto.PageResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private static final Tika TIKA = new Tika();

    private final DocumentRepository            repository;
    private final EncryptionService             encryptionService;
    private final DocumentMapper                mapper;
    private final MinioClient                   minioClient;
    private final MinioProperties               minioProps;
    private final DocumentProperties            docProps;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final AuditService                  auditService;
    private final MeterRegistry                 meterRegistry;

    @Transactional
    public DocumentResponse upload(UUID userId, MultipartFile file, DocumentCategory category) {
        Timer.Sample uploadSample = Timer.start(meterRegistry);

        // --- 1. Size validation ---
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File must not be empty");
        }
        if (file.getSize() > docProps.maxSizeBytes()) {
            long limitMb = docProps.maxSizeBytes() / (1024 * 1024);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "File size " + file.getSize() + " bytes exceeds limit of " + limitMb + " MB");
        }

        // --- 2. MIME detection (Tika reads magic bytes; never trusts client Content-Type alone) ---
        String detectedMime = detectMime(file);
        if (!docProps.allowedMimeTypes().contains(detectedMime)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "File type '" + detectedMime + "' is not allowed. Supported: " + docProps.allowedMimeTypes());
        }

        // --- 3. Generate storage key — never use the client filename as the object key ---
        String ext        = extractExtension(file.getOriginalFilename(), detectedMime);
        String storageKey = userId + "/" + UUID.randomUUID() + "." + ext;

        // --- 4. Encrypt the original filename before any persistence ---
        String rawFilename       = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        byte[] encryptedFilename = encryptionService.encrypt(rawFilename);

        // --- 5. Stream to MinIO (spring's MultipartFile spools to a temp file on disk;
        //        getInputStream() reads from that temp file — as streaming as standard MVC gets) ---
        try {
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(minioProps.bucketName())
                    .object(storageKey)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(detectedMime)
                    .build()
            );
        } catch (Exception e) {
            log.error("MinIO upload failed for key {}: {}", storageKey, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Failed to upload file to storage");
        }

        // --- 6. Persist document row ---
        Document doc = Document.builder()
            .userId(userId)
            .encryptedFilename(encryptedFilename)
            .storageKey(storageKey)
            .mimeType(detectedMime)
            .sizeBytes(file.getSize())
            .category(category)
            .status(DocumentStatus.UPLOADED)
            .build();

        Document saved = repository.save(doc);

        // --- Publish document.uploaded event (fail-open) ---
        // If Kafka is unreachable the upload still succeeds; the document stays UPLOADED
        // and will not be auto-processed until the event is eventually delivered.
        try {
            kafkaTemplate.send("document.uploaded",
                saved.getId().toString(),
                new DocumentUploadedEvent(saved.getId(), userId));
        } catch (Exception e) {
            log.warn("Failed to publish document.uploaded event for document {}: {}",
                saved.getId(), e.getMessage());
        }

        auditService.record(AuditAction.DOCUMENT_UPLOADED, AuditResourceType.DOCUMENT, saved.getId(), userId,
                Map.of("filename", rawFilename, "mimeType", detectedMime, "sizeBytes", file.getSize()));

        // Custom metrics: count uploads by category, record total upload+write duration
        Counter.builder("documents.uploaded.count")
                .tag("category", category.name())
                .description("Number of documents uploaded, tagged by category")
                .register(meterRegistry)
                .increment();
        uploadSample.stop(Timer.builder("documents.upload.duration")
                .tag("category", category.name())
                .description("End-to-end upload duration including MinIO write")
                .register(meterRegistry));

        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public DocumentStatusResponse getStatus(UUID userId, UUID id) {
        Document doc = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
        return new DocumentStatusResponse(
            doc.getStatus(),
            doc.getProcessedAt(),
            doc.getMetricsExtractedCount(),
            doc.getProcessingError()
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> findAll(UUID userId, DocumentCategory category,
                                                   DocumentStatus status, Pageable pageable) {
        Specification<Document> spec = Specification
            .where(DocumentSpecifications.forUser(userId))
            .and(DocumentSpecifications.notDeleted());

        if (category != null) spec = spec.and(DocumentSpecifications.byCategory(category));
        if (status   != null) spec = spec.and(DocumentSpecifications.byStatus(status));

        return PageResponse.from(repository.findAll(spec, pageable).map(mapper::toResponse));
    }

    @Transactional(readOnly = true)
    public DocumentResponse findById(UUID userId, UUID id) {
        return repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .map(mapper::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    @Transactional(readOnly = true)
    public DownloadUrlResponse getDownloadUrl(UUID userId, UUID id) {
        Document doc = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));

        try {
            String url = minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(minioProps.bucketName())
                    .object(doc.getStorageKey())
                    .expiry(minioProps.presignedUrlExpiryMinutes(), TimeUnit.MINUTES)
                    .build()
            );
            DownloadUrlResponse response = new DownloadUrlResponse(url, minioProps.presignedUrlExpiryMinutes());
            auditService.record(AuditAction.DOCUMENT_VIEWED, AuditResourceType.DOCUMENT, id, userId, null);
            return response;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for document {}: {}", id, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Failed to generate download URL");
        }
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Document doc = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));

        // Hard delete from MinIO — we keep the DB row as an audit trail ("a document existed")
        // without retaining the actual sensitive file bytes indefinitely (asymmetric by design).
        try {
            minioClient.removeObject(
                RemoveObjectArgs.builder()
                    .bucket(minioProps.bucketName())
                    .object(doc.getStorageKey())
                    .build()
            );
        } catch (Exception e) {
            log.warn("Could not remove MinIO object '{}': {}", doc.getStorageKey(), e.getMessage());
            // Proceed with DB soft-delete even if MinIO delete fails; object may already be gone.
        }

        doc.setDeletedAt(OffsetDateTime.now());
        repository.save(doc);
        auditService.record(AuditAction.DOCUMENT_DELETED, AuditResourceType.DOCUMENT, id, userId, null);
    }

    // ---- helpers ----------------------------------------------------------------

    private String detectMime(MultipartFile file) {
        try {
            return TIKA.detect(file.getInputStream(), file.getOriginalFilename());
        } catch (Exception e) {
            // Fallback to client-declared type; rejected by allowlist if unsupported
            String declared = file.getContentType();
            return declared != null ? declared : "application/octet-stream";
        }
    }

    private String extractExtension(String originalFilename, String mimeType) {
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) {
                String ext = originalFilename.substring(dot + 1).toLowerCase().replaceAll("[^a-z0-9]", "");
                if (!ext.isEmpty()) return ext;
            }
        }
        return switch (mimeType) {
            case "application/pdf" -> "pdf";
            case "image/jpeg"      -> "jpg";
            case "image/png"       -> "png";
            default                -> "bin";
        };
    }
}
