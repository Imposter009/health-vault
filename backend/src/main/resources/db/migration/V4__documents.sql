-- Phase 3: secure document storage
-- original_filename is intentionally NOT stored in plaintext.
-- The encrypted form lives in encrypted_filename (BYTEA); decrypted at read-time by EncryptionService.

CREATE TABLE healthvault.documents (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES healthvault.users(id) ON DELETE CASCADE,
    encrypted_filename BYTEA       NOT NULL,
    storage_key        VARCHAR(512) NOT NULL,
    mime_type          VARCHAR(100) NOT NULL,
    size_bytes         BIGINT      NOT NULL,
    category           VARCHAR(50) NOT NULL,
    status             VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ,
    CONSTRAINT chk_document_category CHECK (category IN
        ('LAB_REPORT','PRESCRIPTION','SCAN','INSURANCE','OTHER')),
    CONSTRAINT chk_document_status   CHECK (status IN
        ('UPLOADED','PROCESSING','PROCESSED','FAILED'))
);

CREATE INDEX idx_documents_user_uploaded ON healthvault.documents (user_id, uploaded_at);
CREATE INDEX idx_documents_user_category ON healthvault.documents (user_id, category);
