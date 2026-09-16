package com.healthvault.medications.dto;

import com.healthvault.medications.MedicationStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MedicationUpdateRequest(
    @NotBlank String name,
    @NotBlank String dosage,
    @NotBlank String frequency,
    String prescribingDoctor,
    @NotNull LocalDate startDate,
    LocalDate endDate,
    @NotNull MedicationStatus status,
    String notes
) {}
