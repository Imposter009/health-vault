package com.healthvault.audit.repository;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.entity.AuditLog;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.UUID;

public class AuditLogSpecifications {

    private AuditLogSpecifications() {}

    public static Specification<AuditLog> forUser(UUID userId) {
        return (root, query, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<AuditLog> byAction(AuditAction action) {
        return (root, query, cb) -> cb.equal(root.get("action"), action);
    }

    public static Specification<AuditLog> fromDate(OffsetDateTime from) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from);
    }

    public static Specification<AuditLog> toDate(OffsetDateTime to) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to);
    }
}
