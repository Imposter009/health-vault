package com.healthvault.integration;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;

/**
 * Shared Testcontainers base for all backend integration tests.
 *
 * All four containers (Postgres, Redis, Kafka, MinIO) are declared as static
 * so they start once per JVM run and are reused by every subclass — Spring
 * caches the ApplicationContext across tests that share the same configuration.
 *
 * Requires Docker Desktop (or equivalent) running on the host.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
abstract class BaseIntegrationTest {

    static final String MINIO_USER     = "minioadmin";
    static final String MINIO_PASSWORD = "minioadmin";
    static final String BUCKET_NAME    = "health-vault-documents";

    @Container
    static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("healthvault_test")
                    .withUsername("test")
                    .withPassword("test")
                    .withStartupTimeout(Duration.ofSeconds(60));

    @Container
    static final GenericContainer<?> redis =
            new GenericContainer<>("redis:7-alpine")
                    .withExposedPorts(6379)
                    .waitingFor(Wait.forListeningPort())
                    .withStartupTimeout(Duration.ofSeconds(30));

    @Container
    static final KafkaContainer kafka =
            new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.0"))
                    .withStartupTimeout(Duration.ofSeconds(90));

    @Container
    static final GenericContainer<?> minio =
            new GenericContainer<>("minio/minio:RELEASE.2024-07-04T14-25-45Z")
                    .withEnv("MINIO_ROOT_USER", MINIO_USER)
                    .withEnv("MINIO_ROOT_PASSWORD", MINIO_PASSWORD)
                    .withCommand("server", "/data")
                    .withExposedPorts(9000)
                    .waitingFor(
                            Wait.forHttp("/minio/health/live")
                                .forPort(9000)
                                .withStartupTimeout(Duration.ofSeconds(60))
                    );

    @DynamicPropertySource
    static void registerContainerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);

        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));

        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);

        registry.add("minio.endpoint",    () -> "http://localhost:" + minio.getMappedPort(9000));
        registry.add("minio.access-key",  () -> MINIO_USER);
        registry.add("minio.secret-key",  () -> MINIO_PASSWORD);
    }

    /**
     * Ensures the MinIO bucket exists before any test runs.
     * The MinIO container starts empty — bucket creation is not automatic.
     */
    @BeforeAll
    static void ensureMinioBucketExists() throws Exception {
        String endpoint = "http://localhost:" + minio.getMappedPort(9000);
        MinioClient client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(MINIO_USER, MINIO_PASSWORD)
                .build();

        boolean exists = client.bucketExists(
                BucketExistsArgs.builder().bucket(BUCKET_NAME).build());
        if (!exists) {
            client.makeBucket(MakeBucketArgs.builder().bucket(BUCKET_NAME).build());
        }
    }
}
