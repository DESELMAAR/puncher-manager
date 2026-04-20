package com.punchermanager.web.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record PlanningResponseDto(
    String employeeId,
    LocalDate date,
    LocalTime expectedStartTime,
    LocalTime expectedEndTime,
    boolean workingDay) {}
