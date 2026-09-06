package com.healthvault.ingestion.event;

import java.util.UUID;

/**
 * Published by IngestionService after a document is successfully marked PROCESSED.
 * Any Spring bean — including those in the AI package — may listen for this event.
 *
 * When AI features are disabled (healthvault.ai.enabled=false), no listener exists
 * for this event type and the publish is a no-op. The ingestion pipeline's success
 * is therefore never coupled to whether AI features are on.
 */
public record DocumentIngestionCompletedEvent(
        UUID documentId,
        UUID userId
) {}
