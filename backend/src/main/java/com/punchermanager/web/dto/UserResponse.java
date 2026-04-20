package com.punchermanager.web.dto;

import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import java.time.LocalDate;
import java.util.UUID;

public record UserResponse(
    UUID id,
    String name,
    String email,
    String employeeId,
    String phoneNumber,
    LocalDate hiringDate,
    UserStatus status,
    UserRole role,
    UUID departmentId,
    UUID teamId) {}
