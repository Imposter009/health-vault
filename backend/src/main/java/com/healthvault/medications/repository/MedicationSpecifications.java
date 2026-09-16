package com.healthvault.medications.repository;

import com.healthvault.medications.MedicationStatus;
import com.healthvault.medications.entity.Medication;
import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

public final class MedicationSpecifications {

    private MedicationSpecifications() {}

    public static Specification<Medication> forUser(UUID userId) {
        return (root, q, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<Medication> notDeleted() {
        return (root, q, cb) -> cb.isNull(root.get("deletedAt"));
    }

    public static Specification<Medication> byStatus(MedicationStatus status) {
        return (root, q, cb) -> cb.equal(root.get("status"), status);
    }
}
