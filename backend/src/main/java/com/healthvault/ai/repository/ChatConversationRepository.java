package com.healthvault.ai.repository;

import com.healthvault.ai.entity.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, UUID> {

    Optional<ChatConversation> findByIdAndUserId(UUID id, UUID userId);
}
