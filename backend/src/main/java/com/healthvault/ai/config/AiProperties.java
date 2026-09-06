package com.healthvault.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI feature configuration — all values are env-var backed.
 * Every field has a safe default so the app starts cleanly when AI is disabled.
 *
 * Activated only when healthvault.ai.enabled=true; see AiConfig for bean wiring.
 */
@ConfigurationProperties(prefix = "healthvault.ai")
public record AiProperties(

        boolean enabled,

        // ── Provider ──────────────────────────────────────────────────────────
        String openaiApiKey,

        // Model names — externalized so they can be changed without recompiling
        String chatModel,
        String embeddingModel,

        // ── Token budgets ─────────────────────────────────────────────────────
        // Max characters of OCR text sent per summarization call.
        // ~4000 chars ≈ 1000 tokens (rough: 1 token ≈ 4 chars for English medical text).
        int summarizationMaxInputChars,

        // Max tokens the model may produce in a single chat/summarization response.
        int maxResponseTokens,

        // ── RAG retrieval ─────────────────────────────────────────────────────
        int ragTopK,                 // number of most-similar chunks to retrieve

        // ── Chat history window ───────────────────────────────────────────────
        int chatHistoryMaxMessages,  // max messages kept per conversation (cost cap)

        // ── Trend narration thresholds ────────────────────────────────────────
        // A trend is considered significant when |slope| / mean > this value.
        // Default 0.005 = 0.5% change per time unit (bucket).
        double trendSlopeThreshold,

        // ── Chunking ──────────────────────────────────────────────────────────
        int chunkSizeChars,          // target chunk size in characters
        int chunkOverlapChars        // overlap between consecutive chunks

) {}
