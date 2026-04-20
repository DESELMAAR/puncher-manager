package com.punchermanager.web.dto;

import com.punchermanager.domain.ScheduleConfirmationStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record WeeklyScheduleResponse(
    UUID scheduleId,
    UUID employeeId,
    LocalDate weekStart,
    UUID createdByUserId,
    Instant updatedAt,
    List<WeeklyScheduleDayDto> days,
    ScheduleConfirmationStatus confirmationStatus,
    String confirmationComment,
    Instant respondedAt) {}

