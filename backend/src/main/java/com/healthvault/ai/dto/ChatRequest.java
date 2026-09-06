package com.healthvault.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ChatRequest(
        @NotBlank
        @Size(max = 2000, message = "Question must be 2000 characters or fewer")
        String question,

        /** Optional — provide to continue an existing conversation. */
        UUID conversationId
) {}
