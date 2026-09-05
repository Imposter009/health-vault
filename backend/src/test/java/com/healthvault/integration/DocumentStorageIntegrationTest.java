package com.healthvault.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests document upload → MinIO storage → presigned URL download against
 * real Postgres + real MinIO (via Testcontainers).
 */
class DocumentStorageIntegrationTest extends BaseIntegrationTest {

    @Autowired TestRestTemplate rest;

    private String bearerToken;

    @BeforeEach
    void registerAndLogin() {
        String email = "doc-" + System.currentTimeMillis() + "@test.com";
        String pass  = "SecurePass@1234";

        rest.postForEntity("/api/auth/register",
                Map.of("email", email, "password", pass, "name", "Doc User"),
                Map.class);

        ResponseEntity<Map> login = rest.postForEntity("/api/auth/login",
                Map.of("email", email, "password", pass), Map.class);

        bearerToken = (String) login.getBody().get("accessToken");
    }

    // ── Upload ────────────────────────────────────────────────────────────

    @Test
    void upload_pdf_returns_201_with_document_id() {
        ResponseEntity<Map> resp = uploadFile("report.pdf", "application/pdf", pdfBytes());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).containsKey("id");
        assertThat(resp.getBody().get("status")).isEqualTo("PENDING");
    }

    @Test
    void uploaded_document_appears_in_listing() {
        uploadFile("lab.pdf", "application/pdf", pdfBytes());

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);
        ResponseEntity<Map> resp = rest.exchange(
                "/api/documents?page=0&size=20",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        // At least one document
        assertThat(((Number) resp.getBody().get("totalElements")).intValue()).isGreaterThanOrEqualTo(1);
    }

    // ── Presigned URL ─────────────────────────────────────────────────────

    @Test
    void presigned_url_for_uploaded_document_returns_200() {
        // Upload
        ResponseEntity<Map> upload = uploadFile("scan.pdf", "application/pdf", pdfBytes());
        String docId = (String) upload.getBody().get("id");

        // Request presigned URL
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);
        ResponseEntity<Map> urlResp = rest.exchange(
                "/api/documents/" + docId + "/url",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);

        assertThat(urlResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((String) urlResp.getBody().get("url"))
                .startsWith("http://"); // presigned URL from MinIO
    }

    @Test
    void presigned_url_is_accessible_without_auth() {
        // Upload
        ResponseEntity<Map> upload = uploadFile("ecg.pdf", "application/pdf", pdfBytes());
        String docId = (String) upload.getBody().get("id");

        // Get presigned URL
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);
        ResponseEntity<Map> urlResp = rest.exchange(
                "/api/documents/" + docId + "/url",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        String presignedUrl = (String) urlResp.getBody().get("url");

        // HTTP GET the presigned URL without any auth header — should return 200
        // (MinIO presigned URLs embed credentials in query params)
        ResponseEntity<byte[]> download = rest.getForEntity(presignedUrl, byte[].class);
        assertThat(download.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(download.getBody()).isNotEmpty();
    }

    // ── Cross-user isolation ──────────────────────────────────────────────

    @Test
    void cannot_access_another_users_document() {
        // User A uploads
        ResponseEntity<Map> upload = uploadFile("private.pdf", "application/pdf", pdfBytes());
        String docId = (String) upload.getBody().get("id");

        // Register User B
        String emailB = "b-" + System.currentTimeMillis() + "@test.com";
        rest.postForEntity("/api/auth/register",
                Map.of("email", emailB, "password", "SecurePass@1234", "name", "B"),
                Map.class);
        ResponseEntity<Map> loginB = rest.postForEntity("/api/auth/login",
                Map.of("email", emailB, "password", "SecurePass@1234"), Map.class);
        String tokenB = (String) loginB.getBody().get("accessToken");

        // User B tries to get presigned URL for User A's document
        HttpHeaders hB = new HttpHeaders();
        hB.setBearerAuth(tokenB);
        ResponseEntity<Map> resp = rest.exchange(
                "/api/documents/" + docId + "/url",
                HttpMethod.GET, new HttpEntity<>(hB), Map.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ── Size validation ───────────────────────────────────────────────────

    @Test
    void upload_exceeding_max_size_returns_400() {
        // 6 MB — exceeds the 5 MB limit in application-test.yml
        byte[] bigFile = new byte[6 * 1024 * 1024];

        ResponseEntity<Map> resp = uploadFile("big.pdf", "application/pdf", bigFile);

        assertThat(resp.getStatusCode().is4xxClientError()).isTrue();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private ResponseEntity<Map> uploadFile(String filename, String contentType, byte[] data) {
        HttpHeaders multipartHeaders = new HttpHeaders();
        multipartHeaders.setBearerAuth(bearerToken);
        multipartHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        ByteArrayResource resource = new ByteArrayResource(data) {
            @Override public String getFilename() { return filename; }
        };
        body.add("file", new HttpEntity<>(resource,
                headers(contentType)));

        return rest.exchange("/api/documents",
                HttpMethod.POST,
                new HttpEntity<>(body, multipartHeaders),
                Map.class);
    }

    private HttpHeaders headers(String contentType) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType(contentType));
        return h;
    }

    /** Minimal valid PDF bytes — not a real document but triggers the correct MIME detection. */
    private static byte[] pdfBytes() {
        return "%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF".getBytes();
    }
}
