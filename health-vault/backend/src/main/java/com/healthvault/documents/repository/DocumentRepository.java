package com.healthvault.documents.repository;

import com.healthvault.documents.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository
    extends JpaRepository<Document, UUID>, JpaSpecificationExecutor<Document> {

    Optional<Document> findByIdAndUserIdAndDeletedAtIsNull(UUID id, UUID userId);
}
