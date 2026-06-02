package com.punchermanager.web.dto;

import java.time.LocalDate;

public record AttendanceRiskEvaluateResponse(LocalDate asOf, int alertsCreated) {}
