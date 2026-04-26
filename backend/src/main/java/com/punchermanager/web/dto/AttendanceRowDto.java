package com.punchermanager.web.dto;

import com.punchermanager.domain.AttendanceStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record AttendanceRowDto(
    UUID userId,
    String name,
    String employeeId,
    String departmentName,
    String teamName,
    String deptManagerName,
    String teamLeaderName,
    String teamLeaderEmail,
    String deptManagerEmail,
    LocalDate recordDate,
    AttendanceStatus status,
    LocalTime expectedStart,
    LocalTime actualStart,
    Integer minutesLate,
    List<PunchResponse> punches,
    /** SUPER_ADMIN / ADMIN only: whether punches match weekly schedule for this date. */
    Boolean scheduleVsPlanOk,
    /** SUPER_ADMIN / ADMIN only: short explanation or "OK". */
    String scheduleVsPlanNote) {}
