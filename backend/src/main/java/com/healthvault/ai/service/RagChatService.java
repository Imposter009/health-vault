package com.healthvault.ai.service;

import com.healthvault.ai.config.AiProperties;
import com.healthvault.ai.dto.ChatRequest;
import com.healthvault.ai.dto.ChatResponse;
import com.healthvault.ai.entity.AiInteractionType;
import com.healthvault.ai.entity.ChatConversation;
import com.healthvault.ai.entity.ChatMessage;
import com.healthvault.ai.repository.ChatConversationRepository;
import com.healthvault.ai.repository.ChatMessageRepository;
import com.healthvault.common.EncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(value = "healthvault.ai.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class RagChatService {

    private static final String SYSTEM_PROMPT = """
            You are a personal health assistant for the user. You answer questions about the user's
            own health records only, based on the document excerpts provided in the context below.

            Rules:
            - Only use information from the provided document excerpts to answer.
            - If the excerpts don't contain enough information, say so — do not fabricate.
            - Never provide diagnoses or medical advice. Remind the user to consult a healthcare provider.
            - Keep answers concise (under 250 words).
            - If the user's question is unrelated to their health records, politely decline to answer.
            - Always end responses with: "For personalised advice, please consult your healthcare provider."

            Document excerpts from the user's health records:
            ---
            %s
            ---
            """;

    private static final String SIMILARITY_SQL = """
            SELECT document_id, chunk_index, chunk_text,
                   1 - (embedding <=> ?::vector) AS similarity
            FROM healthvault.document_embeddings
            WHERE user_id = ?
            ORDER BY embedding <=> ?::vector
            LIMIT ?
            """;

    private final ChatModel                  chatModel;
    private final EmbeddingModel             embeddingModel;
    private final EncryptionService          encryptionService;
    private final JdbcTemplate              jdbcTemplate;
    private final ChatConversationRepository conversationRepo;
    private final ChatMessageRepository      messageRepo;
    private final AiInteractionLogger        logger;
    private final AiProperties              props;

    @Transactional
    public ChatResponse chat(UUID userId, ChatRequest request) {
        // --- 1. Resolve or create conversation ---
        ChatConversation conversation;
        if (request.conversationId() != null) {
            conversation = conversationRepo.findByIdAndUserId(request.conversationId(), userId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Conversation not found"));
        } else {
            conversation = conversationRepo.save(
                    ChatConversation.builder().userId(userId).build());
        }

        // --- 2. Embed user question ---
        float[] questionVector = embeddingModel.embed(request.question());
        String vectorStr = EmbeddingService.toVectorString(questionVector);

        // --- 3. Similarity search — user-scoped (security boundary) ---
        record ChunkRow(UUID documentId, int chunkIndex, byte[] chunkTextEncrypted) {}
        List<ChunkRow> rows = jdbcTemplate.query(
                SIMILARITY_SQL,
                ps -> {
                    ps.setString(1, vectorStr);
                    ps.setObject(2, userId);
                    ps.setString(3, vectorStr);
                    ps.setInt(4, props.ragTopK());
                },
                (rs, i) -> new ChunkRow(
                        rs.getObject("document_id", UUID.class),
                        rs.getInt("chunk_index"),
                        rs.getBytes("chunk_text")));

        // --- 4. Decrypt chunk texts and build context ---
        StringBuilder contextBuilder = new StringBuilder();
        List<ChatResponse.Source> sources = new ArrayList<>();
        for (ChunkRow row : rows) {
            try {
                String chunk = encryptionService.decrypt(row.chunkTextEncrypted());
                contextBuilder.append("[Document ").append(row.documentId())
                        .append(", chunk ").append(row.chunkIndex()).append("]\n")
                        .append(chunk).append("\n\n");
                sources.add(new ChatResponse.Source(row.documentId(), row.chunkIndex()));
            } catch (Exception e) {
                log.warn("Failed to decrypt chunk doc={} chunk={}: {}", row.documentId(), row.chunkIndex(), e.getMessage());
            }
        }

        String context = contextBuilder.isEmpty()
                ? "(No relevant documents found in your health records.)"
                : contextBuilder.toString();

        // --- 5. Build prompt with conversation history ---
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(SYSTEM_PROMPT.formatted(context)));

        List<ChatMessage> history = messageRepo.findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        int historyStart = Math.max(0, history.size() - props.chatHistoryMaxMessages());
        for (int i = historyStart; i < history.size(); i++) {
            ChatMessage msg = history.get(i);
            messages.add("user".equals(msg.getRole())
                    ? new UserMessage(msg.getContent())
                    : new AssistantMessage(msg.getContent()));
        }
        messages.add(new UserMessage(request.question()));

        // --- 6. Call LLM ---
        String answer = chatModel.call(new Prompt(messages)).getResult().getOutput().getText();

        // --- 7. Persist messages ---
        messageRepo.save(ChatMessage.builder()
                .conversationId(conversation.getId())
                .role("user")
                .content(request.question())
                .build());
        messageRepo.save(ChatMessage.builder()
                .conversationId(conversation.getId())
                .role("assistant")
                .content(answer)
                .build());

        // --- 8. Log interaction ---
        int approxContextTokens = context.length() / 4 + request.question().length() / 4;
        int approxAnswerTokens  = answer.length() / 4;
        logger.log(userId, AiInteractionType.RAG_QUERY, conversation.getId(),
                approxContextTokens, approxAnswerTokens);

        return new ChatResponse(conversation.getId(), answer, sources);
    }
}
