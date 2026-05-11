package com.punchermanager.web.dto;

import java.util.UUID;

public record AttendanceLateEmployeeDto(
    UUID userId,
    String name,
    String employeeId,
    String departmentName,
    String teamName,
    /** Sum of minutes late across LATE records in the selected range. */
    int totalLateMinutes,
    /** Number of calendar days with status LATE in the range. */
    int lateDayCount) {}
