-- Phase 2: Health metric tracking
-- metric_type VARCHAR + CHECK keeps the DB human-readable and extensible
-- without another migration when a new type is added.

CREATE TABLE healthvault.health_metrics (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES healthvault.users(id) ON DELETE CASCADE,
    metric_type  VARCHAR(50) NOT NULL,
    -- JSONB value shapes by metric_type (contract for frontend forms and future OCR extraction):
    --   BLOOD_PRESSURE        : {"systolic": 120, "diastolic": 80}
    --   BLOOD_SUGAR           : {"mgPerDl": 95, "context": "FASTING|POST_MEAL|RANDOM"}
    --   WEIGHT                : {"kg": 72.5}
    --   WORKOUT               : {"type": "RUNNING", "durationMinutes": 30, "intensity": "LOW|MODERATE|HIGH"}
    --   HEART_RATE            : {"bpm": 68}
    value        JSONB       NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL,
    source       VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,          -- soft delete; NULL = active

    CONSTRAINT chk_metric_type CHECK (metric_type IN
        ('BLOOD_PRESSURE','BLOOD_SUGAR','WEIGHT','WORKOUT','HEART_RATE')),
    CONSTRAINT chk_source CHECK (source IN
        ('MANUAL','DEVICE_SYNC','EXTRACTED_FROM_DOCUMENT'))
);

-- Primary query pattern: user + type + time range (dashboard, filtered list)
CREATE INDEX idx_health_metrics_user_type_recorded
    ON healthvault.health_metrics (user_id, metric_type, recorded_at);

-- Secondary pattern: all metrics for a user over time (unfiltered list)
CREATE INDEX idx_health_metrics_user_recorded
    ON healthvault.health_metrics (user_id, recorded_at);
