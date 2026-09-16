-- Medications & Prescriptions tracking

CREATE TABLE healthvault.medications (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES healthvault.users(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    dosage              VARCHAR(100) NOT NULL,
    frequency           VARCHAR(100) NOT NULL,
    prescribing_doctor  VARCHAR(200),
    start_date          DATE        NOT NULL,
    end_date            DATE,                 -- NULL = ongoing
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,          -- soft delete; NULL = active

    CONSTRAINT chk_medication_status CHECK (status IN ('ACTIVE','COMPLETED','DISCONTINUED'))
);

-- Primary query pattern: user + status filter (list page)
CREATE INDEX idx_medications_user_status ON healthvault.medications (user_id, status);

-- Secondary pattern: all medications for a user (unfiltered list)
CREATE INDEX idx_medications_user_deleted ON healthvault.medications (user_id, deleted_at);
