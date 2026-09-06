package com.healthvault.ai.service;

import com.healthvault.ai.entity.AiInteraction;
import com.healthvault.ai.entity.AiInteractionType;
import com.healthvault.ai.repository.AiInteractionRepository;
import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.entity.AuditLog;
import com.healthvault.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AiInteractionLogger {

    private final AiInteractionRepository interactionRepo;
    private final AuditLogRepository      auditRepo;

    /**
     * Persists an AI interaction and a corresponding audit entry.
     * REQUIRES_NEW ensures a logging failure never rolls back the calling transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID log(UUID userId, AiInteractionType type, UUID resourceId,
                    int promptTokens, int completionTokens) {

        AiInteraction interaction = AiInteraction.builder()
                .userId(userId)
                .interactionType(type)
                .resourceId(resourceId)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .build();
        interaction = interactionRepo.save(interaction);

        AuditLog audit = AuditLog.builder()
                .userId(userId)
                .action(AuditAction.AI_QUERY)
                .resourceType(AuditResourceType.AI_INTERACTION)
                .resourceId(interaction.getId())
                .metadata(Map.of("type", type.name()))
                .build();
        auditRepo.save(audit);

        return interaction.getId();
    }
}
