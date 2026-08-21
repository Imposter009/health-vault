-- Phase 1: auth schema — users and refresh_tokens tables
-- pgcrypto is needed for gen_random_uuid() on PostgreSQL < 13; pg 13+ has it built-in,
-- but CREATE EXTENSION IF NOT EXISTS is safe to run regardless.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE healthvault.users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE healthvault.refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES healthvault.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id    ON healthvault.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON healthvault.refresh_tokens(token_hash);
