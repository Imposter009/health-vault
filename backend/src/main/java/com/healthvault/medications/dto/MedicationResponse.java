package com.healthvault.medications.dto;

import com.healthvault.medications.MedicationStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MedicationResponse(
    UUID id,
    UUID userId,
    String name,
    String dosage,
    String frequency,
    String prescribingDoctor,
    LocalDate startDate,
    LocalDate endDate,
    MedicationStatus status,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
