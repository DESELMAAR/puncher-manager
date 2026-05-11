package com.punchermanager.web.dto;

import java.time.LocalDate;
import java.util.List;

public record AttendanceAnalyticsResponseDto(
    LocalDate from,
    LocalDate to,
    int totalRecords,
    int presentCount,
    int lateCount,
    int absentCount,
    double presentPct,
    double latePct,
    double absentPct,
    Double avgWorkHours,
    List<AttendanceAnalyticsPointDto> daily,
    List<AttendanceAnalyticsPointDto> weekly,
    List<AttendanceAnalyticsPointDto> monthly) {}

