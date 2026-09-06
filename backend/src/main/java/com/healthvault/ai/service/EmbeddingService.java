package com.healthvault.ai.service;

import com.healthvault.ai.config.AiProperties;
import com.healthvault.ai.util.TextChunker;
import com.healthvault.common.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class EmbeddingService {

    private final EmbeddingModel    embeddingModel;
    private final EncryptionService encryptionService;
    private final JdbcTemplate      jdbcTemplate;
    private final AiProperties      props;

    private static final String INSERT_SQL = """
            INSERT INTO healthvault.document_embeddings
                (document_id, user_id, chunk_index, chunk_text, embedding)
            VALUES (?, ?, ?, ?, ?::vector)
            """;

    /**
     * Chunks, embeds, encrypts, and stores a document's text.
     * Deletes existing embeddings first so re-processing a document is idempotent.
     *
     * @param documentId document owner
     * @param userId     user — included in every row for security-scoped RAG queries
     * @param plainText  decrypted OCR text
     */
    @Transactional
    public void embedDocument(UUID documentId, UUID userId, String plainText) {
        // Delete existing to allow idempotent re-embedding after a retry
        jdbcTemplate.update(
                "DELETE FROM healthvault.document_embeddings WHERE document_id = ?",
                documentId);

        List<String> chunks = TextChunker.chunk(
                plainText,
                props.chunkSizeChars(),
                props.chunkOverlapChars());

        if (chunks.isEmpty()) {
            log.warn("No chunks produced for document {} — skipping embedding", documentId);
            return;
        }

        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            float[] vector = embeddingModel.embed(chunk);

            byte[] encryptedChunk;
            try {
                encryptedChunk = encryptionService.encrypt(chunk);
            } catch (Exception e) {
                log.error("Failed to encrypt chunk {} for document {}: {}", i, documentId, e.getMessage());
                throw new RuntimeException("Chunk encryption failed", e);
            }

            jdbcTemplate.update(INSERT_SQL,
                    documentId,
                    userId,
                    i,
                    encryptedChunk,
                    toVectorString(vector));
        }

        log.info("Embedded {} chunks for document {}", chunks.size(), documentId);
    }

    /** Converts float[] to PostgreSQL pgvector literal: [f1,f2,...] */
    static String toVectorString(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }
}
