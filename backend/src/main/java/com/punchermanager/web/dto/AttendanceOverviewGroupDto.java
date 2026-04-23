package com.punchermanager.web.dto;

import java.util.List;
import java.util.UUID;

public record AttendanceOverviewGroupDto(
    UUID departmentId,
    String departmentName,
    UUID teamId,
    String teamName,
    List<AttendanceRowDto> rows) {}

