package com.healthvault.ingestion.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "document_extractions", schema = "healthvault")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentExtraction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;

    // AES-256-GCM ciphertext of the full OCR text; null if no text was extractable.
    @Column(name = "extracted_text_encrypted", columnDefinition = "bytea")
    private byte[] extractedTextEncrypted;

    // AES-256-GCM ciphertext of the AI-generated summary; null until AI processes the doc.
    @Column(name = "summary_text_encrypted", columnDefinition = "bytea")
    private byte[] summaryTextEncrypted;

    // JSON array of extraction matches: [{metricType, value, rawMatch}, ...]
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extracted_metrics", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Map<String, Object>> extractedMetrics = List.of();

    @Column(name = "extraction_error", columnDefinition = "TEXT")
    private String extractionError;

    @CreationTimestamp
    @Column(name = "extracted_at", nullable = false, updatable = false)
    private OffsetDateTime extractedAt;
}
