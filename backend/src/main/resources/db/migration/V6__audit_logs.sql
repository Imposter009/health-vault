-- V6: Audit trail for sensitive user actions
-- Stores immutable records of authentication events, document access, and health data changes.
-- user_id is nullable to allow recording login failures before a user object is resolved.

CREATE TABLE healthvault.audit_logs (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         REFERENCES healthvault.users(id) ON DELETE SET NULL,
    action        VARCHAR(64)  NOT NULL,
    resource_type VARCHAR(32),
    resource_id   UUID,
    ip_address    VARCHAR(45),   -- IPv4 (15) or IPv6 (39); 45 = max with IPv4-mapped
    user_agent    VARCHAR(512),
    metadata_json JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary access pattern: fetch a user's log sorted by recency, with optional action filter
CREATE INDEX idx_audit_logs_user_created ON healthvault.audit_logs (user_id, created_at DESC);
-- Secondary: admin dashboards or anomaly detection that group by action
CREATE INDEX idx_audit_logs_action_created ON healthvault.audit_logs (action, created_at DESC);
