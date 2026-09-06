package com.healthvault.ai.controller;

import com.healthvault.ai.dto.ChatRequest;
import com.healthvault.ai.dto.ChatResponse;
import com.healthvault.ai.service.RagChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai/chat")
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AiChatController {

    private final RagChatService ragChatService;

    @PostMapping
    public ChatResponse chat(
            @Valid @RequestBody ChatRequest request,
            Authentication auth) {

        return ragChatService.chat(UUID.fromString(auth.getName()), request);
    }
}
