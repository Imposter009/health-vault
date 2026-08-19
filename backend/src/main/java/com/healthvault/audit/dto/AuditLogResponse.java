package com.healthvault.audit.dto;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        AuditAction action,
        AuditResourceType resourceType,
        UUID resourceId,
        String ipAddress,
        Map<String, Object> metadata,
        OffsetDateTime createdAt
) {}
