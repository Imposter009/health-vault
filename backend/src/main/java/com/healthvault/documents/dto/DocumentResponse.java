package com.healthvault.documents.dto;

import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentResponse(
    UUID id,
    String filename,          // decrypted for display — never the storage_key
    DocumentCategory category,
    DocumentStatus status,
    String mimeType,
    long sizeBytes,
    OffsetDateTime uploadedAt,
    OffsetDateTime processedAt    // null until OCR pipeline completes
) {}
