package com.healthvault.documents.repository;

import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.entity.Document;
import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

public final class DocumentSpecifications {

    private DocumentSpecifications() {}

    public static Specification<Document> forUser(UUID userId) {
        return (root, q, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<Document> notDeleted() {
        return (root, q, cb) -> cb.isNull(root.get("deletedAt"));
    }

    public static Specification<Document> byCategory(DocumentCategory category) {
        return (root, q, cb) -> cb.equal(root.get("category"), category);
    }

    public static Specification<Document> byStatus(DocumentStatus status) {
        return (root, q, cb) -> cb.equal(root.get("status"), status);
    }
}
