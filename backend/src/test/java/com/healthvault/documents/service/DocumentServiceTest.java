package com.healthvault.documents.service;

import com.healthvault.audit.service.AuditService;
import com.healthvault.common.EncryptionService;
import com.healthvault.common.EncryptionProperties;
import com.healthvault.documents.DocumentCategory;
import com.healthvault.documents.DocumentMapper;
import com.healthvault.documents.DocumentStatus;
import com.healthvault.documents.config.DocumentProperties;
import com.healthvault.documents.config.MinioProperties;
import com.healthvault.documents.dto.DocumentResponse;
import com.healthvault.documents.dto.DownloadUrlResponse;
import com.healthvault.documents.entity.Document;
import com.healthvault.documents.repository.DocumentRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.kafka.core.KafkaTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock DocumentRepository            repository;
    @Mock MinioClient                   minioClient;
    @Mock KafkaTemplate<String, Object> kafkaTemplate;
    @Mock AuditService                  auditService;

    // Real encryption service (no mock — easier to test round-trip)
    EncryptionService  encryptionService;
    DocumentMapper     mapper;
    DocumentProperties docProps;
    MinioProperties    minioProps;
    MeterRegistry      meterRegistry;

    DocumentService service;

    private final UUID USER_ID = UUID.randomUUID();
    private final UUID DOC_ID  = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        byte[] key = new byte[32];
        for (int i = 0; i < 32; i++) key[i] = (byte) i;
        encryptionService = new EncryptionService(new EncryptionProperties(Base64.getEncoder().encodeToString(key)));
        mapper        = new DocumentMapper(encryptionService);
        docProps      = new DocumentProperties(26_214_400L, List.of("application/pdf", "image/jpeg", "image/png"));
        minioProps    = new MinioProperties("http://localhost:9000", "minioadmin", "minioadmin",
                                            "health-vault-documents", 5);
        meterRegistry = new SimpleMeterRegistry();
        service = new DocumentService(repository, encryptionService, mapper, minioClient, minioProps, docProps,
                                      kafkaTemplate, auditService, meterRegistry);
    }

    // ---- upload ----------------------------------------------------------------

    @Test
    void upload_emptyFile_returns400() {
        MockMultipartFile empty = new MockMultipartFile("file", new byte[0]);
        assertThatThrownBy(() -> service.upload(USER_ID, empty, DocumentCategory.OTHER))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void upload_oversizedFile_returns400() {
        byte[] bigData = new byte[(int) docProps.maxSizeBytes() + 1];
        MockMultipartFile big = new MockMultipartFile("file", "big.pdf", "application/pdf", bigData);
        assertThatThrownBy(() -> service.upload(USER_ID, big, DocumentCategory.LAB_REPORT))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void upload_unsupportedMimeType_returns400() {
        // .exe file — Tika will detect application/x-msdownload or similar
        byte[] exeHeader = new byte[] { 0x4D, 0x5A, 0x00, 0x00 }; // MZ header
        MockMultipartFile exe = new MockMultipartFile("file", "malware.exe", "application/octet-stream", exeHeader);
        assertThatThrownBy(() -> service.upload(USER_ID, exe, DocumentCategory.OTHER))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void upload_validPdf_persistsAndReturnsResponse() throws Exception {
        byte[] pdfBytes = pdfMagicBytes("hello");
        MockMultipartFile file = new MockMultipartFile(
            "file", "blood-test.pdf", "application/pdf", pdfBytes);

        Document saved = buildDoc("blood-test.pdf");
        when(repository.save(any(Document.class))).thenReturn(saved);

        DocumentResponse resp = service.upload(USER_ID, file, DocumentCategory.LAB_REPORT);

        assertThat(resp.filename()).isEqualTo("blood-test.pdf");
        assertThat(resp.category()).isEqualTo(DocumentCategory.LAB_REPORT);

        // Verify MinIO put was called
        verify(minioClient).putObject(any(PutObjectArgs.class));

        // Verify storageKey stored in entity does NOT contain the original filename
        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getStorageKey()).doesNotContain("blood-test.pdf");
        assertThat(captor.getValue().getEncryptedFilename()).isNotEmpty();
    }

    // ---- findById --------------------------------------------------------------

    @Test
    void findById_notFound_returns404() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(USER_ID, DOC_ID))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findById_wrongOwner_returns404() {
        UUID otherUser = UUID.randomUUID();
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, otherUser))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(otherUser, DOC_ID))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ---- getDownloadUrl --------------------------------------------------------

    @Test
    void getDownloadUrl_notFound_returns404() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDownloadUrl(USER_ID, DOC_ID))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void getDownloadUrl_validOwner_returnsUrlWithExpiry() throws Exception {
        Document doc = buildDoc("scan.pdf");
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.of(doc));
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
            .thenReturn("http://localhost:9000/health-vault-documents/" + doc.getStorageKey() + "?X-Amz-Signature=abc");

        DownloadUrlResponse resp = service.getDownloadUrl(USER_ID, DOC_ID);

        assertThat(resp.url()).contains("health-vault-documents");
        assertThat(resp.expiryMinutes()).isEqualTo(5);
    }

    // ---- delete ----------------------------------------------------------------

    @Test
    void delete_notFound_returns404() {
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(USER_ID, DOC_ID))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void delete_validOwner_hardDeletesMinioAndSoftDeletesDb() throws Exception {
        Document doc = buildDoc("prescription.pdf");
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.of(doc));
        when(repository.save(any(Document.class))).thenReturn(doc);

        service.delete(USER_ID, DOC_ID);

        // MinIO hard-deleted
        verify(minioClient).removeObject(any(RemoveObjectArgs.class));

        // DB row soft-deleted (deletedAt set)
        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void delete_minioFailure_stillSoftDeletesDb() throws Exception {
        Document doc = buildDoc("report.pdf");
        when(repository.findByIdAndUserIdAndDeletedAtIsNull(DOC_ID, USER_ID))
            .thenReturn(Optional.of(doc));
        doThrow(new RuntimeException("MinIO unavailable"))
            .when(minioClient).removeObject(any(RemoveObjectArgs.class));
        when(repository.save(any(Document.class))).thenReturn(doc);

        // Should not throw — MinIO failure is warned and swallowed
        service.delete(USER_ID, DOC_ID);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    // ---- helpers ---------------------------------------------------------------

    private Document buildDoc(String originalFilename) {
        byte[] enc = encryptionService.encrypt(originalFilename);
        return Document.builder()
            .id(DOC_ID)
            .userId(USER_ID)
            .encryptedFilename(enc)
            .storageKey(USER_ID + "/test-uuid.pdf")
            .mimeType("application/pdf")
            .sizeBytes(1024L)
            .category(DocumentCategory.LAB_REPORT)
            .status(DocumentStatus.UPLOADED)
            .build();
    }

    private static byte[] pdfMagicBytes(String extra) {
        // Minimal valid PDF magic: %PDF- header
        byte[] header  = "%PDF-1.4\n".getBytes();
        byte[] payload = extra.getBytes();
        byte[] result  = new byte[header.length + payload.length];
        System.arraycopy(header,  0, result, 0,             header.length);
        System.arraycopy(payload, 0, result, header.length, payload.length);
        return result;
    }
}
