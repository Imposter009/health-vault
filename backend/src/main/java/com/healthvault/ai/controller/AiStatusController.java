package com.healthvault.ai.controller;

import com.healthvault.ai.dto.AiStatusResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Always-present endpoint — no @ConditionalOnProperty.
 * Returns {enabled: true/false} so the Angular frontend can discover at runtime
 * whether AI features are available on this instance, without hardcoding assumptions
 * in environment.ts.
 */
@RestController
@RequestMapping("/api/ai/status")
public class AiStatusController {

    private final boolean aiEnabled;

    public AiStatusController(@Value("${healthvault.ai.enabled:false}") boolean aiEnabled) {
        this.aiEnabled = aiEnabled;
    }

    @GetMapping
    public AiStatusResponse status() {
        return new AiStatusResponse(aiEnabled);
    }
}
