package com.healthvault.ai.repository;

import com.healthvault.ai.entity.AiInteraction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiInteractionRepository extends JpaRepository<AiInteraction, UUID> {}
