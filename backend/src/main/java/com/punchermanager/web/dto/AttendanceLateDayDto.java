package com.punchermanager.web.dto;

import java.time.LocalDate;

public record AttendanceLateDayDto(LocalDate recordDate, int minutesLate) {}
