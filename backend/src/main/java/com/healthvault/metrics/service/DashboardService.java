package com.healthvault.metrics.service;

import com.healthvault.metrics.DashboardGranularity;
import com.healthvault.metrics.MetricType;
import com.healthvault.metrics.dto.DashboardBucketResponse;
import com.healthvault.metrics.dto.DashboardResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final JdbcTemplate jdbc;

    @Cacheable(
        value = "dashboard",
        key   = "#userId + ':' + #type + ':' + #from.toLocalDate() + ':' + #to.toLocalDate() + ':' + #granularity"
    )
    public DashboardResponse getDashboard(UUID userId, MetricType type,
                                          OffsetDateTime from, OffsetDateTime to,
                                          DashboardGranularity granularity) {
        String trunc = granularity.toDateTruncArg();
        String sql   = buildSql(type, trunc);

        List<DashboardBucketResponse> buckets = jdbc.query(
            sql,
            ps -> {
                ps.setObject(1, userId);
                ps.setString(2, type.name());
                ps.setObject(3, from);
                ps.setObject(4, to);
            },
            (rs, rowNum) -> mapRow(rs, type)
        );

        return new DashboardResponse(
            type,
            from.toLocalDate().toString(),
            to.toLocalDate().toString(),
            granularity,
            buckets
        );
    }

    // Package-visible for unit testing of SQL-generation logic.
    String buildSql(MetricType type, String trunc) {
        return switch (type) {
            case WEIGHT     -> numericSql("kg",       trunc);
            case HEART_RATE -> numericSql("bpm",      trunc);
            case BLOOD_SUGAR -> numericSql("mgPerDl", trunc);
            case BLOOD_PRESSURE -> bloodPressureSql(trunc);
            case WORKOUT        -> workoutSql(trunc);
        };
    }

    private String numericSql(String field, String trunc) {
        // All columns present in every query; unused ones are NULL so mapRow() is uniform.
        return """
            SELECT date_trunc('%s', recorded_at) AS bucket_start,
                   ROUND(AVG((value->>'%s')::numeric)::numeric, 2) AS avg_val,
                   ROUND(MIN((value->>'%s')::numeric)::numeric, 2) AS min_val,
                   ROUND(MAX((value->>'%s')::numeric)::numeric, 2) AS max_val,
                   NULL::double precision AS avg_systolic,
                   NULL::double precision AS avg_diastolic,
                   NULL::double precision AS min_systolic,
                   NULL::double precision AS max_systolic,
                   NULL::bigint           AS total_duration,
                   COUNT(*)               AS cnt
            FROM healthvault.health_metrics
            WHERE user_id = ?
              AND metric_type = ?
              AND recorded_at >= ?
              AND recorded_at <= ?
              AND deleted_at IS NULL
            GROUP BY date_trunc('%s', recorded_at)
            ORDER BY bucket_start ASC
            """.formatted(trunc, field, field, field, trunc);
    }

    private String bloodPressureSql(String trunc) {
        return """
            SELECT date_trunc('%s', recorded_at) AS bucket_start,
                   NULL::double precision AS avg_val,
                   NULL::double precision AS min_val,
                   NULL::double precision AS max_val,
                   ROUND(AVG((value->>'systolic')::numeric)::numeric,  2) AS avg_systolic,
                   ROUND(AVG((value->>'diastolic')::numeric)::numeric, 2) AS avg_diastolic,
                   ROUND(MIN((value->>'systolic')::numeric)::numeric,  2) AS min_systolic,
                   ROUND(MAX((value->>'systolic')::numeric)::numeric,  2) AS max_systolic,
                   NULL::bigint AS total_duration,
                   COUNT(*)     AS cnt
            FROM healthvault.health_metrics
            WHERE user_id = ?
              AND metric_type = ?
              AND recorded_at >= ?
              AND recorded_at <= ?
              AND deleted_at IS NULL
            GROUP BY date_trunc('%s', recorded_at)
            ORDER BY bucket_start ASC
            """.formatted(trunc, trunc);
    }

    private String workoutSql(String trunc) {
        return """
            SELECT date_trunc('%s', recorded_at) AS bucket_start,
                   NULL::double precision AS avg_val,
                   NULL::double precision AS min_val,
                   NULL::double precision AS max_val,
                   NULL::double precision AS avg_systolic,
                   NULL::double precision AS avg_diastolic,
                   NULL::double precision AS min_systolic,
                   NULL::double precision AS max_systolic,
                   SUM((value->>'durationMinutes')::numeric)::bigint AS total_duration,
                   COUNT(*) AS cnt
            FROM healthvault.health_metrics
            WHERE user_id = ?
              AND metric_type = ?
              AND recorded_at >= ?
              AND recorded_at <= ?
              AND deleted_at IS NULL
            GROUP BY date_trunc('%s', recorded_at)
            ORDER BY bucket_start ASC
            """.formatted(trunc, trunc);
    }

    private DashboardBucketResponse mapRow(ResultSet rs, MetricType type) throws SQLException {
        Timestamp ts = rs.getTimestamp("bucket_start");
        String bucketStart = ts.toLocalDateTime().toLocalDate().toString();
        return new DashboardBucketResponse(
            bucketStart,
            getDouble(rs, "avg_val"),
            getDouble(rs, "min_val"),
            getDouble(rs, "max_val"),
            getDouble(rs, "avg_systolic"),
            getDouble(rs, "avg_diastolic"),
            getDouble(rs, "min_systolic"),
            getDouble(rs, "max_systolic"),
            getLong(rs, "total_duration"),
            rs.getLong("cnt")
        );
    }

    private Double getDouble(ResultSet rs, String col) throws SQLException {
        double v = rs.getDouble(col);
        return rs.wasNull() ? null : v;
    }

    private Long getLong(ResultSet rs, String col) throws SQLException {
        long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }
}
