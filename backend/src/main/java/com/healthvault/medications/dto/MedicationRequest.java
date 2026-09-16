package com.healthvault.medications.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MedicationRequest(
    @NotBlank String name,
    @NotBlank String dosage,
    @NotBlank String frequency,
    String prescribingDoctor,
    @NotNull LocalDate startDate,
    LocalDate endDate,
    String notes
) {}
