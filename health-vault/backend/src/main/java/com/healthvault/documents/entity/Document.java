package com.healthvault.documents.entity;

import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "documents", schema = "healthvault")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    // Plaintext filename is NEVER persisted. Only the AES-256-GCM ciphertext
    // is stored here (IV prepended). Decrypted at read-time by EncryptionService.
    @Column(name = "encrypted_filename", nullable = false, columnDefinition = "bytea")
    private byte[] encryptedFilename;

    // Object key in MinIO — generated server-side as {userId}/{uuid}.{ext}.
    // Never exposed to the client directly.
    @Column(name = "storage_key", nullable = false, updatable = false, length = 512)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private DocumentCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.UPLOADED;

    @CreationTimestamp
    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private OffsetDateTime uploadedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // --- Phase 4: OCR pipeline state ---

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @Column(name = "processing_error", columnDefinition = "TEXT")
    private String processingError;

    @Column(name = "metrics_extracted_count", nullable = false)
    @Builder.Default
    private int metricsExtractedCount = 0;
}
