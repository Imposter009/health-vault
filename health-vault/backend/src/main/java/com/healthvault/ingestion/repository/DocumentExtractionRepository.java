package com.healthvault.ingestion.repository;

import com.healthvault.ingestion.entity.DocumentExtraction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentExtractionRepository extends JpaRepository<DocumentExtraction, UUID> {

    List<DocumentExtraction> findByDocumentId(UUID documentId);
}
