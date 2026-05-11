package com.punchermanager.web.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AttendanceAbsentEmployeeDto(
    UUID userId,
    String name,
    String employeeId,
    String departmentName,
    String teamName,
    int absentDayCount,
    /** Dates with ABSENT status, sorted ascending. */
    List<LocalDate> absentDates) {}
