package com.healthvault.medications.controller;

import com.healthvault.medications.MedicationStatus;
import com.healthvault.medications.dto.MedicationRequest;
import com.healthvault.medications.dto.MedicationResponse;
import com.healthvault.medications.dto.MedicationUpdateRequest;
import com.healthvault.medications.service.MedicationService;
import com.healthvault.metrics.dto.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/medications")
@RequiredArgsConstructor
public class MedicationController {

    private final MedicationService medicationService;

    // POST /api/medications
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MedicationResponse create(Authentication auth, @Valid @RequestBody MedicationRequest req) {
        return medicationService.create(userId(auth), req);
    }

    // GET /api/medications
    @GetMapping
    public PageResponse<MedicationResponse> list(
            Authentication auth,
            @RequestParam(required = false) MedicationStatus status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startDate"));
        return medicationService.findAll(userId(auth), status, pr);
    }

    // GET /api/medications/{id}
    @GetMapping("/{id}")
    public MedicationResponse getById(Authentication auth, @PathVariable UUID id) {
        return medicationService.findById(userId(auth), id);
    }

    // PUT /api/medications/{id}
    @PutMapping("/{id}")
    public MedicationResponse update(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody MedicationUpdateRequest req) {
        return medicationService.update(userId(auth), id, req);
    }

    // DELETE /api/medications/{id}
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable UUID id) {
        medicationService.delete(userId(auth), id);
    }

    // -------------------------------------------------------------------------

    private UUID userId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
