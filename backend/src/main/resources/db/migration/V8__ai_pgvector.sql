-- V8: Spring AI — pgvector extension, embeddings, AI interaction log, chat tables.
-- Requires the pgvector extension (0.5+). HNSW index needs pgvector 0.5+.
--
-- Embedding dimension: 1536 — matches OpenAI text-embedding-3-small default output.
-- If you switch to a different embedding model, update the VECTOR(N) dimensions here
-- AND drop/recreate the HNSW index (which is dimension-specific).

-- ── 1. pgvector extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Cache AI-generated summaries alongside the existing extraction row ────
-- Added to document_extractions rather than a separate table because there is
-- a 1:1 relationship (one extraction record per document, one summary per extraction).
ALTER TABLE healthvault.document_extractions
    ADD COLUMN IF NOT EXISTS summary_text_encrypted BYTEA;  -- AES-256-GCM; NULL until summarized

-- ── 3. document_embeddings ──────────────────────────────────────────────────
-- Stores pgvector embeddings for each text chunk of a processed document.
--
-- user_id is deliberately denormalized here (it is already on the documents table).
-- Every similarity search MUST filter by user_id to enforce the per-user data boundary.
-- Without user_id on this table, every search would require a JOIN to documents, adding
-- latency on the hot path. The denormalization is intentional and documented here.
CREATE TABLE IF NOT EXISTS healthvault.document_embeddings (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID         NOT NULL
        REFERENCES healthvault.documents(id) ON DELETE CASCADE,
    user_id       UUID         NOT NULL
        REFERENCES healthvault.users(id)     ON DELETE CASCADE,
    chunk_index   INT          NOT NULL,          -- 0-based order within document
    chunk_text    BYTEA        NOT NULL,           -- AES-256-GCM encrypted chunk text
    embedding     VECTOR(1536) NOT NULL,           -- OpenAI text-embedding-3-small (1536-dim)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- HNSW index for approximate nearest-neighbour search with cosine distance.
-- HNSW chosen over IVFFlat: better recall at query time and no training step needed
-- (IVFFlat requires a separate CREATE INDEX ... WITH (lists = N) training pass that
-- depends on knowing the data size upfront — impractical for incremental document ingestion).
-- ef_construction=128 / m=16 are pgvector's recommended defaults for a balanced trade-off.
CREATE INDEX IF NOT EXISTS idx_document_embeddings_hnsw
    ON healthvault.document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Index for the mandatory per-user filter in every similarity search.
CREATE INDEX IF NOT EXISTS idx_document_embeddings_user_id
    ON healthvault.document_embeddings (user_id);

-- ── 4. ai_interactions — operational/cost audit trail for AI calls ───────────
-- Separate from the general audit_log (Phase 6) because AI interactions have
-- additional operational shape: token usage for cost tracking.
-- The Phase 6 audit_log still receives a corresponding entry for user-facing
-- "who accessed my data" transparency (written by AiInteractionLogger).
CREATE TABLE IF NOT EXISTS healthvault.ai_interactions (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL
        REFERENCES healthvault.users(id) ON DELETE CASCADE,
    interaction_type  VARCHAR(50)  NOT NULL,   -- SUMMARIZATION | RAG_QUERY | TREND_NARRATION
    resource_id       UUID,                    -- e.g. document_id for SUMMARIZATION; NULL for RAG
    prompt_tokens     INT,                     -- from provider usage response
    completion_tokens INT,                     -- from provider usage response
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id
    ON healthvault.ai_interactions (user_id);

-- ── 5. chat_conversations / chat_messages — multi-turn RAG context ───────────
CREATE TABLE IF NOT EXISTS healthvault.chat_conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL
        REFERENCES healthvault.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
    ON healthvault.chat_conversations (user_id);

CREATE TABLE IF NOT EXISTS healthvault.chat_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL
        REFERENCES healthvault.chat_conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,    -- 'user' | 'assistant'
    content         TEXT        NOT NULL,    -- not encrypted; chat content is ephemeral context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
    ON healthvault.chat_messages (conversation_id, created_at);
