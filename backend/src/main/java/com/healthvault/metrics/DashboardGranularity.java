package com.healthvault.metrics;

public enum DashboardGranularity {
    DAY, WEEK, MONTH;

    /** Maps to the argument accepted by PostgreSQL's date_trunc() function. */
    public String toDateTruncArg() {
        return name().toLowerCase();
    }
}
