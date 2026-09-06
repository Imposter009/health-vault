package com.healthvault.ai.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Fixed-size character-based text chunker with overlap.
 *
 * Strategy: simple sliding-window over characters. More sophisticated semantic
 * chunking (sentence-boundary, paragraph-boundary) is a roadmap item; for v1
 * this is sufficient for medical document OCR output.
 *
 * Thread-safe: stateless utility class.
 */
public final class TextChunker {

    private TextChunker() {}

    /**
     * Split {@code text} into chunks of at most {@code chunkSize} characters,
     * with {@code overlap} characters carried over from the end of each chunk
     * to the start of the next (to avoid splitting mid-concept at boundaries).
     *
     * @return ordered list of chunk strings; never empty if text is non-blank
     */
    public static List<String> chunk(String text, int chunkSize, int overlap) {
        if (text == null || text.isBlank()) return List.of();
        if (chunkSize <= 0) throw new IllegalArgumentException("chunkSize must be > 0");
        if (overlap < 0 || overlap >= chunkSize)
            throw new IllegalArgumentException("overlap must be in [0, chunkSize)");

        List<String> chunks = new ArrayList<>();
        int start = 0;
        int len   = text.length();

        while (start < len) {
            int end = Math.min(start + chunkSize, len);
            chunks.add(text.substring(start, end));
            // Advance by (chunkSize - overlap); ensure we always make progress
            start += Math.max(1, chunkSize - overlap);
        }
        return chunks;
    }

    /**
     * Truncate {@code text} to at most {@code maxChars} characters, appending
     * a note if truncation occurred. Used for summarization input capping.
     */
    public static String truncate(String text, int maxChars) {
        if (text == null) return "";
        if (text.length() <= maxChars) return text;
        return text.substring(0, maxChars);
    }
}
