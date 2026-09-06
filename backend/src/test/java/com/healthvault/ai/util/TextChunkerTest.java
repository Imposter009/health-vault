package com.healthvault.ai.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TextChunkerTest {

    @Test
    void emptyTextReturnsEmptyList() {
        List<String> chunks = TextChunker.chunk("", 100, 20);
        assertTrue(chunks.isEmpty());
    }

    @Test
    void blankTextReturnsEmptyList() {
        List<String> chunks = TextChunker.chunk("   ", 100, 20);
        assertTrue(chunks.isEmpty());
    }

    @Test
    void shortTextFitsInOneChunk() {
        List<String> chunks = TextChunker.chunk("Hello world", 100, 10);
        assertEquals(1, chunks.size());
        assertEquals("Hello world", chunks.get(0));
    }

    @Test
    void textLongerThanChunkSizeIsSplit() {
        String text = "A".repeat(250);
        List<String> chunks = TextChunker.chunk(text, 100, 0);
        assertEquals(3, chunks.size());
        assertEquals(100, chunks.get(0).length());
        assertEquals(100, chunks.get(1).length());
        assertEquals(50,  chunks.get(2).length());
    }

    @Test
    void overlapCausesChunksToPrefixPreviousContent() {
        // 200 chars, chunkSize=100, overlap=20 → step=80 → starts at 0, 80, 160 → 3 chunks
        String text = "0".repeat(100) + "1".repeat(100);
        List<String> chunks = TextChunker.chunk(text, 100, 20);
        // chunk[0] = chars 0-99 (all 0s)
        // chunk[1] = chars 80-179 → 20 chars of 0s + 80 chars of 1s
        // chunk[2] = chars 160-199 (all 1s)
        assertEquals(3, chunks.size());
        assertTrue(chunks.get(1).startsWith("0".repeat(20)),
                "Second chunk should start with 20 overlap chars from the first chunk");
    }

    @Test
    void truncateShortStringUnchanged() {
        String text = "short";
        assertEquals("short", TextChunker.truncate(text, 100));
    }

    @Test
    void truncateClipsAtMaxChars() {
        String text = "X".repeat(200);
        String result = TextChunker.truncate(text, 100);
        assertEquals(100, result.length());
    }

    @Test
    void truncateNullReturnsEmptyString() {
        assertEquals("", TextChunker.truncate(null, 100));
    }

    @Test
    void overlapLargerThanChunkSizeThrowsIllegalArgument() {
        // overlap >= chunkSize is a clear misconfiguration — the utility validates it eagerly
        assertThrows(IllegalArgumentException.class,
                () -> TextChunker.chunk("hello world foo bar", 5, 10));
    }
}
