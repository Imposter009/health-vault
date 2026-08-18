package com.healthvault.ingestion.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Service;

import java.io.InputStream;

/**
 * Extracts plain text from a document stream using Apache Tika.
 *
 * For PDFs with embedded text, Tika's PDFBox parser extracts natively (no Tesseract needed).
 * For image-based PDFs or scanned images, Tika delegates to Tesseract if it is installed.
 * If Tesseract is absent, image-only content yields an empty string (graceful degradation).
 *
 * The caller should treat an empty result as "no extractable text" — not as a failure.
 */
@Service
@Slf4j
public class OcrService {

    private static final AutoDetectParser PARSER = new AutoDetectParser();

    /**
     * @param stream   document bytes (caller is responsible for closing)
     * @param filename hint for MIME detection (may be null)
     * @return extracted plain text; empty string if nothing was extractable
     * @throws Exception if Tika itself throws an unrecoverable parse error
     */
    public String extractText(InputStream stream, String filename) throws Exception {
        // -1 = no character limit on extracted text
        BodyContentHandler handler = new BodyContentHandler(-1);
        Metadata metadata = new Metadata();
        if (filename != null) {
            metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, filename);
        }
        ParseContext ctx = new ParseContext();
        PARSER.parse(stream, handler, metadata, ctx);
        String text = handler.toString();
        log.debug("Extracted {} characters from '{}'", text.length(), filename);
        return text;
    }
}
