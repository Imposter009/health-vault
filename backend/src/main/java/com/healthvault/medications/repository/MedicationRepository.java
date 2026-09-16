package com.healthvault.medications.repository;

import com.healthvault.medications.entity.Medication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface MedicationRepository
        extends JpaRepository<Medication, UUID>, JpaSpecificationExecutor<Medication> {

    // Combines id + userId ownership check + soft-delete guard in one query.
    // Returns empty if not found OR not owned by userId — prevents existence leakage.
    Optional<Medication> findByIdAndUserIdAndDeletedAtIsNull(UUID id, UUID userId);
}
