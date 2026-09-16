package com.healthvault.medications.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.service.AuditService;
import com.healthvault.medications.MedicationMapper;
import com.healthvault.medications.MedicationStatus;
import com.healthvault.medications.dto.MedicationRequest;
import com.healthvault.medications.dto.MedicationResponse;
import com.healthvault.medications.dto.MedicationUpdateRequest;
import com.healthvault.metrics.dto.PageResponse;
import com.healthvault.medications.entity.Medication;
import com.healthvault.medications.repository.MedicationRepository;
import com.healthvault.medications.repository.MedicationSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository repository;
    private final MedicationMapper mapper;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public PageResponse<MedicationResponse> findAll(UUID userId, MedicationStatus status, Pageable pageable) {
        Specification<Medication> spec = Specification
            .where(MedicationSpecifications.forUser(userId))
            .and(MedicationSpecifications.notDeleted());

        if (status != null) spec = spec.and(MedicationSpecifications.byStatus(status));

        Page<MedicationResponse> page = repository.findAll(spec, pageable).map(mapper::toResponse);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public MedicationResponse findById(UUID userId, UUID id) {
        return repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .map(mapper::toResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medication not found"));
    }

    @Transactional
    public MedicationResponse create(UUID userId, MedicationRequest req) {
        Medication entity = Medication.builder()
            .userId(userId)
            .name(req.name())
            .dosage(req.dosage())
            .frequency(req.frequency())
            .prescribingDoctor(req.prescribingDoctor())
            .startDate(req.startDate())
            .endDate(req.endDate())
            .status(MedicationStatus.ACTIVE)
            .notes(req.notes())
            .build();
        MedicationResponse created = mapper.toResponse(repository.save(entity));
        auditService.record(AuditAction.MEDICATION_CREATED, AuditResourceType.MEDICATION,
                created.id(), userId, Map.of("name", req.name()));
        return created;
    }

    @Transactional
    public MedicationResponse update(UUID userId, UUID id, MedicationUpdateRequest req) {
        Medication entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medication not found"));

        List<String> changed = new ArrayList<>();
        if (!Objects.equals(entity.getName(), req.name())) changed.add("name");
        if (!Objects.equals(entity.getDosage(), req.dosage())) changed.add("dosage");
        if (!Objects.equals(entity.getFrequency(), req.frequency())) changed.add("frequency");
        if (!Objects.equals(entity.getPrescribingDoctor(), req.prescribingDoctor())) changed.add("prescribingDoctor");
        if (!Objects.equals(entity.getStartDate(), req.startDate())) changed.add("startDate");
        if (!Objects.equals(entity.getEndDate(), req.endDate())) changed.add("endDate");
        if (!Objects.equals(entity.getStatus(), req.status())) changed.add("status");
        if (!Objects.equals(entity.getNotes(), req.notes())) changed.add("notes");

        entity.setName(req.name());
        entity.setDosage(req.dosage());
        entity.setFrequency(req.frequency());
        entity.setPrescribingDoctor(req.prescribingDoctor());
        entity.setStartDate(req.startDate());
        entity.setEndDate(req.endDate());
        entity.setStatus(req.status());
        entity.setNotes(req.notes());

        MedicationResponse updated = mapper.toResponse(repository.save(entity));
        auditService.record(AuditAction.MEDICATION_UPDATED, AuditResourceType.MEDICATION, id, userId,
                changed.isEmpty() ? null : Map.of("changedFields", changed));
        return updated;
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Medication entity = repository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Medication not found"));
        entity.setDeletedAt(OffsetDateTime.now());
        repository.save(entity);
        auditService.record(AuditAction.MEDICATION_DELETED, AuditResourceType.MEDICATION, id, userId, null);
    }
}
