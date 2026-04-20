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
    LocalDate recordDate,
    AttendanceStatus status,
    LocalTime expectedStart,
    LocalTime actualStart,
    Integer minutesLate,
    List<PunchResponse> punches) {}
