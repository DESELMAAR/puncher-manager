package com.punchermanager.web.dto;

import java.time.LocalDate;

public record AttendanceAnalyticsPointDto(
    LocalDate periodStart,
    /** Share of attendance records that are ON_TIME (full blue when alone). */
    double onTimePct,
    /** Share of attendance records that are LATE (split blue/amber inside this band). */
    double latePct,
    double absentPct,
    Double avgWorkHours,
    /**
     * For LATE rows in this bucket: sum(minutesLate) / sum(work minutes WORK_START→LOGOUT), as 0–100.
     * Null when there are no late rows or no measurable work duration for late rows.
     */
    Double lateTimeVsWorkPct) {}
