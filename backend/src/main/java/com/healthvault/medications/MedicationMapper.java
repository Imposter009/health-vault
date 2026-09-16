package com.healthvault.medications;

import com.healthvault.medications.dto.MedicationResponse;
import com.healthvault.medications.entity.Medication;
import org.springframework.stereotype.Component;

@Component
public class MedicationMapper {

    public MedicationResponse toResponse(Medication m) {
        return new MedicationResponse(
            m.getId(),
            m.getUserId(),
            m.getName(),
            m.getDosage(),
            m.getFrequency(),
            m.getPrescribingDoctor(),
            m.getStartDate(),
            m.getEndDate(),
            m.getStatus(),
            m.getNotes(),
            m.getCreatedAt(),
            m.getUpdatedAt()
        );
    }
}
