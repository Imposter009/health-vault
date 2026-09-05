package com.healthvault.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies DashboardService.buildSql() produces correct date_trunc aggregations
 * against a real Postgres database. Seeds known rows and asserts exact values.
 */
class MetricsDashboardIntegrationTest extends BaseIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JdbcTemplate     jdbc;

    private String bearerToken;
    private UUID   userId;

    @BeforeEach
    void registerAndLogin() {
        String email = "dash-" + System.currentTimeMillis() + "@test.com";
        String pass  = "SecurePass@1234";

        ResponseEntity<Map> reg = rest.postForEntity(
                "/api/auth/register",
                Map.of("email", email, "password", pass, "name", "Dash User"),
                Map.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        userId = UUID.fromString((String) reg.getBody().get("id"));

        ResponseEntity<Map> login = rest.postForEntity(
                "/api/auth/login",
                Map.of("email", email, "password", pass),
                Map.class);
        bearerToken = (String) login.getBody().get("accessToken");

        // Delete any seed rows from previous test runs for this user
        jdbc.update("DELETE FROM health_metrics WHERE user_id = ?", userId);
    }

    // ── Weight aggregation ────────────────────────────────────────────────

    @Test
    void weight_daily_dashboard_returns_correct_average() {
        String today = LocalDate.now().toString();

        // Seed two weight readings today
        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'WEIGHT', ?::jsonb, NOW())",
            userId, "{\"kg\": 70.0}");
        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'WEIGHT', ?::jsonb, NOW())",
            userId, "{\"kg\": 74.0}");

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);

        ResponseEntity<List> resp = rest.exchange(
                "/api/metrics/dashboard?metricType=WEIGHT&granularity=DAY&from=" + today + "&to=" + today,
                HttpMethod.GET, new HttpEntity<>(h), List.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<?> data = resp.getBody();
        assertThat(data).hasSize(1);

        Map<?, ?> bucket = (Map<?, ?>) data.get(0);
        double avgVal = ((Number) bucket.get("avgVal")).doubleValue();
        assertThat(avgVal).isEqualTo(72.0, within(0.001)); // (70 + 74) / 2
    }

    // ── Heart rate aggregation ────────────────────────────────────────────

    @Test
    void heart_rate_daily_dashboard_returns_correct_average() {
        String today = LocalDate.now().toString();

        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'HEART_RATE', ?::jsonb, NOW())",
            userId, "{\"bpm\": 60}");
        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'HEART_RATE', ?::jsonb, NOW())",
            userId, "{\"bpm\": 80}");

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);

        ResponseEntity<List> resp = rest.exchange(
                "/api/metrics/dashboard?metricType=HEART_RATE&granularity=DAY&from=" + today + "&to=" + today,
                HttpMethod.GET, new HttpEntity<>(h), List.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> bucket = (Map<?, ?>) resp.getBody().get(0);
        assertThat(((Number) bucket.get("avgVal")).doubleValue()).isEqualTo(70.0, within(0.001));
    }

    // ── Blood pressure aggregation ────────────────────────────────────────

    @Test
    void blood_pressure_daily_dashboard_returns_systolic_and_diastolic() {
        String today = LocalDate.now().toString();

        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'BLOOD_PRESSURE', ?::jsonb, NOW())",
            userId, "{\"systolic\": 120, \"diastolic\": 80}");
        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'BLOOD_PRESSURE', ?::jsonb, NOW())",
            userId, "{\"systolic\": 130, \"diastolic\": 90}");

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);

        ResponseEntity<List> resp = rest.exchange(
                "/api/metrics/dashboard?metricType=BLOOD_PRESSURE&granularity=DAY&from=" + today + "&to=" + today,
                HttpMethod.GET, new HttpEntity<>(h), List.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> bucket = (Map<?, ?>) resp.getBody().get(0);
        assertThat(((Number) bucket.get("avgSystolic")).doubleValue()).isEqualTo(125.0, within(0.001));
        assertThat(((Number) bucket.get("avgDiastolic")).doubleValue()).isEqualTo(85.0, within(0.001));
    }

    // ── Cross-user isolation ──────────────────────────────────────────────

    @Test
    void dashboard_only_returns_data_for_authenticated_user() {
        String today = LocalDate.now().toString();

        // Seed a row for a random other user (not our test user)
        UUID otherId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO health_metrics (id, user_id, metric_type, value, recorded_at) " +
            "VALUES (gen_random_uuid(), ?, 'WEIGHT', ?::jsonb, NOW())",
            otherId, "{\"kg\": 200.0}");

        // Our user has no rows
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);

        ResponseEntity<List> resp = rest.exchange(
                "/api/metrics/dashboard?metricType=WEIGHT&granularity=DAY&from=" + today + "&to=" + today,
                HttpMethod.GET, new HttpEntity<>(h), List.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Result must be empty — other user's 200kg must not appear
        assertThat(resp.getBody()).isEmpty();
    }

    // ── Empty result ──────────────────────────────────────────────────────

    @Test
    void dashboard_returns_empty_list_when_no_data_in_range() {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(bearerToken);

        ResponseEntity<List> resp = rest.exchange(
                "/api/metrics/dashboard?metricType=WEIGHT&granularity=DAY&from=2000-01-01&to=2000-01-02",
                HttpMethod.GET, new HttpEntity<>(h), List.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEmpty();
    }

    // ── Assertion helper ──────────────────────────────────────────────────

    private static org.assertj.core.data.Offset<Double> within(double delta) {
        return org.assertj.core.data.Offset.offset(delta);
    }
}
