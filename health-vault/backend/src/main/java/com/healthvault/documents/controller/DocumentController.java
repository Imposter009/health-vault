package com.healthvault.documents.controller;

import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.dto.DocumentResponse;
import com.healthvault.documents.dto.DocumentStatusResponse;
import com.healthvault.documents.dto.DownloadUrlResponse;
import com.healthvault.documents.service.DocumentService;
import com.healthvault.metrics.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService service;

    @PostMapping(consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(
        Authentication auth,
        @RequestPart("file") MultipartFile file,
        @RequestParam DocumentCategory category
    ) {
        return service.upload(userId(auth), file, category);
    }

    @GetMapping
    public PageResponse<DocumentResponse> list(
        Authentication auth,
        @RequestParam(required = false) DocumentCategory category,
        @RequestParam(required = false) DocumentStatus status,
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size,
            Sort.by(Sort.Direction.DESC, "uploadedAt"));
        return service.findAll(userId(auth), category, status, pageable);
    }

    @GetMapping("/{id}")
    public DocumentResponse getById(Authentication auth, @PathVariable UUID id) {
        return service.findById(userId(auth), id);
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(Authentication auth, @PathVariable UUID id) {
        return service.getDownloadUrl(userId(auth), id);
    }

    @GetMapping("/{id}/status")
    public DocumentStatusResponse getStatus(Authentication auth, @PathVariable UUID id) {
        return service.getStatus(userId(auth), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable UUID id) {
        service.delete(userId(auth), id);
    }

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
