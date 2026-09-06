package com.healthvault.ai.controller;

import com.healthvault.ai.dto.SummarizeResponse;
import com.healthvault.ai.service.DocumentSummarizationService;
import com.healthvault.documents.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai/documents")
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AiDocumentController {

    private final DocumentSummarizationService summarizationService;
    private final DocumentRepository           documentRepository;

    @GetMapping("/{documentId}/summary")
    public SummarizeResponse summarize(
            @PathVariable UUID documentId,
            Authentication auth) {

        UUID userId = UUID.fromString(auth.getName());

        // findByIdAndUserIdAndDeletedAtIsNull enforces both ownership and soft-delete boundary
        documentRepository.findByIdAndUserIdAndDeletedAtIsNull(documentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Document not found or access denied"));

        return summarizationService.summarize(documentId, userId);
    }
}
