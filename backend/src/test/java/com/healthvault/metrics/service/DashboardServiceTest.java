package com.healthvault.metrics.service;

import com.healthvault.metrics.MetricType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests the SQL-generation logic in DashboardService#buildSql().
 * The method is package-private so this test lives in the same package.
 * Actual query execution is covered by MetricsDashboardIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    JdbcTemplate jdbc;

    @InjectMocks
    DashboardService service;

    // ── Common assertions ─────────────────────────────────────────────────

    private void assertCommonClauses(String sql, String trunc) {
        assertThat(sql).contains("FROM healthvault.health_metrics");
        assertThat(sql).contains("WHERE user_id = ?");
        assertThat(sql).contains("AND metric_type = ?");
        assertThat(sql).contains("AND recorded_at >= ?");
        assertThat(sql).contains("AND recorded_at <= ?");
        assertThat(sql).contains("AND deleted_at IS NULL");
        assertThat(sql).contains("date_trunc('" + trunc + "'");
        assertThat(sql).contains("ORDER BY bucket_start ASC");
        assertThat(sql).contains("COUNT(*)");
    }

    // ── WEIGHT ────────────────────────────────────────────────────────────

    @Test
    void weight_sql_aggregates_kg_field() {
        String sql = service.buildSql(MetricType.WEIGHT, "day");
        assertCommonClauses(sql, "day");
        assertThat(sql).contains("value->>'kg'");
        assertThat(sql).contains("AVG");
        assertThat(sql).contains("MIN");
        assertThat(sql).contains("MAX");
        // Blood-pressure columns should be NULL fillers
        assertThat(sql).contains("NULL::double precision AS avg_systolic");
    }

    // ── HEART_RATE ────────────────────────────────────────────────────────

    @Test
    void heart_rate_sql_aggregates_bpm_field() {
        String sql = service.buildSql(MetricType.HEART_RATE, "week");
        assertCommonClauses(sql, "week");
        assertThat(sql).contains("value->>'bpm'");
    }

    // ── BLOOD_SUGAR ───────────────────────────────────────────────────────

    @Test
    void blood_sugar_sql_aggregates_mgPerDl_field() {
        String sql = service.buildSql(MetricType.BLOOD_SUGAR, "month");
        assertCommonClauses(sql, "month");
        assertThat(sql).contains("value->>'mgPerDl'");
    }

    // ── BLOOD_PRESSURE ────────────────────────────────────────────────────

    @Test
    void blood_pressure_sql_aggregates_systolic_and_diastolic() {
        String sql = service.buildSql(MetricType.BLOOD_PRESSURE, "day");
        assertCommonClauses(sql, "day");
        assertThat(sql).contains("value->>'systolic'");
        assertThat(sql).contains("value->>'diastolic'");
        assertThat(sql).contains("avg_systolic");
        assertThat(sql).contains("avg_diastolic");
        // Scalar avg/min/max columns are NULL fillers in the BP query
        assertThat(sql).contains("NULL::double precision AS avg_val");
    }

    // ── WORKOUT ───────────────────────────────────────────────────────────

    @Test
    void workout_sql_sums_duration_not_averages() {
        String sql = service.buildSql(MetricType.WORKOUT, "week");
        assertCommonClauses(sql, "week");
        assertThat(sql).contains("durationMinutes");
        assertThat(sql).contains("SUM");
        assertThat(sql).contains("total_duration");
        // Scalar avg/min/max are NULL in workout query
        assertThat(sql).contains("NULL::double precision AS avg_val");
        assertThat(sql).contains("NULL::double precision AS avg_systolic");
    }

    // ── Granularity propagation ───────────────────────────────────────────

    @Test
    void granularity_propagates_to_date_trunc_and_group_by() {
        for (String trunc : new String[]{"day", "week", "month"}) {
            String sql = service.buildSql(MetricType.WEIGHT, trunc);
            // trunc must appear in both SELECT and GROUP BY
            long occurrences = sql.chars()
                    .filter(c -> c == '\'')
                    .count();
            assertThat(sql).contains("date_trunc('" + trunc + "', recorded_at) AS bucket_start");
            assertThat(sql).contains("GROUP BY date_trunc('" + trunc + "', recorded_at)");
        }
    }

    // ── Parameter placeholders ────────────────────────────────────────────

    @Test
    void sql_has_exactly_four_bind_parameters() {
        for (MetricType type : MetricType.values()) {
            String sql = service.buildSql(type, "day");
            long qmarks = sql.chars().filter(c -> c == '?').count();
            assertThat(qmarks)
                    .as("Expected 4 bind params (userId, type, from, to) for %s", type)
                    .isEqualTo(4);
        }
    }
}
