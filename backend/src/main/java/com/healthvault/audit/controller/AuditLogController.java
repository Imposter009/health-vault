package com.healthvault.audit.controller;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.dto.AuditLogResponse;
import com.healthvault.audit.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit-log")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditService auditService;

    /**
     * Returns the current user's audit log entries only — callers cannot query other users.
     * The user ID is sourced from the validated JWT, not from a request parameter.
     */
    @GetMapping("/me")
    public ResponseEntity<Page<AuditLogResponse>> getMyAuditLog(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID userId = UUID.fromString(jwt.getSubject());
        Page<AuditLogResponse> result = auditService.getForUser(
                userId, action, from, to,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(result);
    }
}
