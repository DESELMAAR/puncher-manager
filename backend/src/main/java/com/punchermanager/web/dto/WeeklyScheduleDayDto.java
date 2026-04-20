package com.punchermanager.web.dto;

import java.time.LocalTime;

public record WeeklyScheduleDayDto(
    int dayOfWeek,
    boolean dayOff,
    LocalTime startTime,
    LocalTime endTime) {}

