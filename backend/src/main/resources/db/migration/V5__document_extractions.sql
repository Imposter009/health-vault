-- Phase 4: async OCR pipeline
-- Adds processing state columns to documents table and creates document_extractions audit table.

ALTER TABLE healthvault.documents
    ADD COLUMN processed_at            TIMESTAMPTZ,
    ADD COLUMN processing_error        TEXT,
    ADD COLUMN metrics_extracted_count INT NOT NULL DEFAULT 0;

-- One extraction record per document processing attempt.
-- Stores encrypted OCR text + JSON array of extracted metric matches for audit/debug.
CREATE TABLE healthvault.document_extractions (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id              UUID         NOT NULL
        REFERENCES healthvault.documents(id) ON DELETE CASCADE,
    extracted_text_encrypted BYTEA,                         -- AES-256-GCM ciphertext; NULL if no text found
    extracted_metrics        JSONB        NOT NULL DEFAULT '[]',  -- array of ExtractionMatch JSON objects
    extraction_error         TEXT,                           -- non-null when OCR itself failed
    extracted_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_extractions_document_id
    ON healthvault.document_extractions (document_id);
