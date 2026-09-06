package com.healthvault.ai.config;

import org.springframework.ai.document.MetadataMode;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Manually-wired Spring AI beans — no autoconfiguration.
 *
 * Using spring-ai-openai (not spring-ai-openai-spring-boot-starter) so that
 * Spring Boot never attempts to autoconfigure OpenAI beans. Autoconfiguration
 * would fail at startup when the API key is absent, breaking the core app.
 * Here every bean is guarded by @ConditionalOnProperty so the entire AI layer
 * is a no-op when healthvault.ai.enabled is false or unset.
 */
@Configuration
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@EnableConfigurationProperties(AiProperties.class)
public class AiConfig {

    @Bean
    public OpenAiApi openAiApi(AiProperties props) {
        return OpenAiApi.builder()
                .apiKey(props.openaiApiKey())
                .build();
    }

    @Bean
    public OpenAiChatModel openAiChatModel(OpenAiApi api, AiProperties props) {
        OpenAiChatOptions options = OpenAiChatOptions.builder()
                .model(props.chatModel())
                .maxTokens(props.maxResponseTokens())
                .build();
        return OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(options)
                .build();
    }

    @Bean
    public OpenAiEmbeddingModel openAiEmbeddingModel(OpenAiApi api, AiProperties props) {
        OpenAiEmbeddingOptions options = OpenAiEmbeddingOptions.builder()
                .model(props.embeddingModel())
                .build();
        return new OpenAiEmbeddingModel(api, MetadataMode.EMBED, options);
    }
}
