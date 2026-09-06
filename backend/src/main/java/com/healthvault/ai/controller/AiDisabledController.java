package com.healthvault.ai.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Catch-all handler active when healthvault.ai.enabled is false or not set.
 * Returns 503 (not 404) so clients know the capability exists but is disabled
 * on this instance — 404 would imply the endpoint doesn't exist at all.
 *
 * When AI is enabled the real feature controllers register and this bean does not,
 * because ConditionalOnProperty with havingValue="false" and matchIfMissing=true
 * matches only the disabled/absent case.
 */
@RestController
@RequestMapping("/api/ai")
@ConditionalOnProperty(
    value          = "healthvault.ai.enabled",
    havingValue    = "false",
    matchIfMissing = true
)
public class AiDisabledController {

    private static final String MESSAGE =
        "AI features are not enabled on this instance. " +
        "Set AI_FEATURES_ENABLED=true and provide OPENAI_API_KEY to activate.";

    @RequestMapping("/**")
    public void handleAll() {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, MESSAGE);
    }
}
