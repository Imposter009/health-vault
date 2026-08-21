package com.healthvault.documents;

import com.healthvault.common.EncryptionService;
import com.healthvault.documents.dto.DocumentResponse;
import com.healthvault.documents.entity.Document;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DocumentMapper {

    private final EncryptionService encryptionService;

    public DocumentResponse toResponse(Document doc) {
        String filename;
        try {
            filename = encryptionService.decrypt(doc.getEncryptedFilename());
        } catch (Exception e) {
            log.warn("Could not decrypt filename for document {}", doc.getId());
            filename = "[encrypted]";
        }
        return new DocumentResponse(
            doc.getId(),
            filename,
            doc.getCategory(),
            doc.getStatus(),
            doc.getMimeType(),
            doc.getSizeBytes(),
            doc.getUploadedAt(),
            doc.getProcessedAt()
        );
    }
}
