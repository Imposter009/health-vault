package com.healthvault.audit.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.dto.AuditLogResponse;
import com.healthvault.audit.entity.AuditLog;
import com.healthvault.audit.repository.AuditLogRepository;
import com.healthvault.audit.repository.AuditLogSpecifications;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository repository;

    /**
     * Record an audit event in its own independent transaction.
     *
     * PROPAGATION.REQUIRES_NEW: the audit write runs in a separate transaction from
     * the caller's transaction. If the audit write fails, the primary action's transaction
     * is unaffected (fail-open). If the primary action rolls back, the audit row is still
     * committed — intentional, so failed attempts are recorded.
     *
     * TRADE-OFF: A HIPAA/SOC2 regulated environment should flip to fail-closed (no
     * try/catch here, let the audit failure propagate and roll back the primary action).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action,
                       AuditResourceType resourceType,
                       UUID resourceId,
                       UUID userId,
                       Map<String, Object> metadata) {
        String ip = null;
        String userAgent = null;
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest req = attrs.getRequest();
                ip = extractClientIp(req);
                userAgent = req.getHeader("User-Agent");
                if (userAgent != null && userAgent.length() > 512) {
                    userAgent = userAgent.substring(0, 512);
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract request context for audit: {}", e.getMessage());
        }

        AuditLog entry = AuditLog.builder()
                .userId(userId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .ipAddress(ip)
                .userAgent(userAgent)
                .metadata(metadata)
                .build();

        try {
            repository.save(entry);
        } catch (Exception e) {
            // Fail-open: log the failure but do not let it bubble up and break the primary action.
            log.error("Failed to write audit log for action={} userId={}: {}", action, userId, e.getMessage());
        }
    }

    public Page<AuditLogResponse> getForUser(UUID userId,
                                             AuditAction action,
                                             OffsetDateTime from,
                                             OffsetDateTime to,
                                             Pageable pageable) {
        Specification<AuditLog> spec = AuditLogSpecifications.forUser(userId);
        if (action != null) {
            spec = spec.and(AuditLogSpecifications.byAction(action));
        }
        if (from != null) {
            spec = spec.and(AuditLogSpecifications.fromDate(from));
        }
        if (to != null) {
            spec = spec.and(AuditLogSpecifications.toDate(to));
        }
        return repository.findAll(spec, pageable).map(this::toResponse);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getAction(),
                log.getResourceType(),
                log.getResourceId(),
                log.getIpAddress(),
                log.getMetadata(),
                log.getCreatedAt()
        );
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // X-Forwarded-For may be a comma-separated list; first entry is the original client
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
