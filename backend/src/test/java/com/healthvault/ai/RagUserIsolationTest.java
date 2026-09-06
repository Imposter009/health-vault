package com.healthvault.ai;

import com.healthvault.integration.BaseIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies that the document_embeddings table enforces user isolation at the SQL level.
 *
 * This test inserts embeddings for two distinct users and then runs the same
 * similarity-search query that RagChatService uses, asserting that each user's
 * query returns only their own chunks — never the other user's.
 *
 * Why test at the SQL level?
 * The security boundary IS the WHERE user_id = ? clause. Testing it directly
 * through JdbcTemplate confirms that boundary independent of the Spring AI
 * bean lifecycle. The test also remains runnable when AI is disabled (no
 * EmbeddingModel or ChatModel needed) because it bypasses the service layer.
 */
class RagUserIsolationTest extends BaseIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    private UUID userA;
    private UUID userB;
    private UUID docA;
    private UUID docB;

    /**
     * We insert minimal rows directly into healthvault.users and
     * healthvault.document_embeddings to exercise the isolation constraint
     * without going through the full upload → OCR → embed pipeline.
     *
     * The embedding vector is a synthetic 1536-dim zero vector — valid pgvector
     * format, sufficient to verify SQL filtering without real embeddings.
     */
    @BeforeEach
    void setUp() {
        userA = UUID.randomUUID();
        userB = UUID.randomUUID();
        docA  = UUID.randomUUID();
        docB  = UUID.randomUUID();

        // Insert users
        insertUser(userA, "rag-test-user-a-" + userA + "@example.com");
        insertUser(userB, "rag-test-user-b-" + userB + "@example.com");

        // Insert a document for each user (minimal row; not going through DocumentService)
        insertDocument(docA, userA);
        insertDocument(docB, userB);

        // Insert one embedding chunk per user
        String zeroVector = "[" + "0.0,".repeat(1535) + "0.0]";
        insertEmbedding(docA, userA, 0, "User A health record chunk".getBytes(), zeroVector);
        insertEmbedding(docB, userB, 0, "User B health record chunk".getBytes(), zeroVector);
    }

    @Test
    void userAQueryReturnsOnlyUserAChunks() {
        List<Map<String, Object>> rows = queryEmbeddings(userA);
        assertEquals(1, rows.size(), "User A should see exactly 1 chunk");
        assertEquals(docA, rows.get(0).get("document_id"),
                "User A's result should reference User A's document");
    }

    @Test
    void userBQueryReturnsOnlyUserBChunks() {
        List<Map<String, Object>> rows = queryEmbeddings(userB);
        assertEquals(1, rows.size(), "User B should see exactly 1 chunk");
        assertEquals(docB, rows.get(0).get("document_id"),
                "User B's result should reference User B's document");
    }

    @Test
    void userACannotSeeUserBChunks() {
        List<Map<String, Object>> rowsA = queryEmbeddings(userA);
        boolean leakDetected = rowsA.stream()
                .anyMatch(row -> docB.equals(row.get("document_id")));
        assertTrue(!leakDetected,
                "User A's RAG query must not return User B's document chunks (cross-user data leak!)");
    }

    @Test
    void userBCannotSeeUserAChunks() {
        List<Map<String, Object>> rowsB = queryEmbeddings(userB);
        boolean leakDetected = rowsB.stream()
                .anyMatch(row -> docA.equals(row.get("document_id")));
        assertTrue(!leakDetected,
                "User B's RAG query must not return User A's document chunks (cross-user data leak!)");
    }

    // --- Helpers ---

    private List<Map<String, Object>> queryEmbeddings(UUID userId) {
        String zeroVector = "[" + "0.0,".repeat(1535) + "0.0]";
        return jdbc.queryForList("""
                SELECT document_id, chunk_index
                FROM healthvault.document_embeddings
                WHERE user_id = ?
                ORDER BY embedding <=> ?::vector
                LIMIT 10
                """, userId, zeroVector);
    }

    private void insertUser(UUID id, String email) {
        // password_hash is a placeholder — these users never authenticate in this test
        jdbc.update("""
                INSERT INTO healthvault.users (id, email, full_name, password_hash)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """,
                id, email, "Test User", "$2a$10$placeholder");
    }

    private void insertDocument(UUID docId, UUID userId) {
        jdbc.update("""
                INSERT INTO healthvault.documents
                    (id, user_id, original_filename, storage_key, mime_type, status, file_size_bytes)
                VALUES (?, ?, ?, ?, ?, 'PROCESSED', 0)
                ON CONFLICT (id) DO NOTHING
                """,
                docId, userId, "test.pdf", "test/" + docId, "application/pdf");
    }

    private void insertEmbedding(UUID docId, UUID userId, int chunkIdx, byte[] chunkText, String vector) {
        jdbc.update("""
                INSERT INTO healthvault.document_embeddings
                    (document_id, user_id, chunk_index, chunk_text, embedding)
                VALUES (?, ?, ?, ?, ?::vector)
                ON CONFLICT DO NOTHING
                """,
                docId, userId, chunkIdx, chunkText, vector);
    }
}
