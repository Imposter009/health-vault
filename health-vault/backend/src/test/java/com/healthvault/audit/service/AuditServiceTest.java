package com.healthvault.audit.service;

import com.healthvault.audit.AuditAction;
import com.healthvault.audit.AuditResourceType;
import com.healthvault.audit.entity.AuditLog;
import com.healthvault.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock AuditLogRepository repository;
    @InjectMocks AuditService auditService;

    @Test
    void record_persistsAuditLogWithCorrectFields() {
        UUID userId     = UUID.randomUUID();
        UUID resourceId = UUID.randomUUID();

        when(repository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        auditService.record(AuditAction.LOGIN_SUCCESS, AuditResourceType.USER,
                resourceId, userId, null);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());

        AuditLog saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo(AuditAction.LOGIN_SUCCESS);
        assertThat(saved.getResourceType()).isEqualTo(AuditResourceType.USER);
        assertThat(saved.getResourceId()).isEqualTo(resourceId);
        assertThat(saved.getUserId()).isEqualTo(userId);
    }

    @Test
    void record_withMetadata_persistsMetadata() {
        UUID userId = UUID.randomUUID();
        Map<String, Object> meta = Map.of("changedFields", "value");

        when(repository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        auditService.record(AuditAction.METRIC_UPDATED, AuditResourceType.HEALTH_METRIC,
                UUID.randomUUID(), userId, meta);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getMetadata()).isEqualTo(meta);
    }

    @Test
    void record_nullableFields_allowed() {
        // user_id is nullable (e.g. for login failure before user is found)
        when(repository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        auditService.record(AuditAction.LOGIN_FAILURE, AuditResourceType.USER,
                null, null, Map.of("reason", "user_not_found"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isNull();
        assertThat(captor.getValue().getResourceId()).isNull();
    }

    @Test
    void record_repositoryThrows_doesNotPropagate() {
        // Fail-open: primary action should succeed even if audit write fails
        doThrow(new RuntimeException("DB down")).when(repository).save(any());

        assertThatCode(() -> auditService.record(AuditAction.LOGOUT, AuditResourceType.USER,
                UUID.randomUUID(), UUID.randomUUID(), null))
                .doesNotThrowAnyException();
    }

    @Test
    void getForUser_delegatesToRepository() {
        UUID userId = UUID.randomUUID();
        when(repository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(
                org.springframework.data.domain.Page.empty());

        auditService.getForUser(userId, null, null, null, PageRequest.of(0, 20));

        verify(repository).findAll(any(Specification.class), any(Pageable.class));
    }
}
