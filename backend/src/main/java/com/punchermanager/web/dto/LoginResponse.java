package com.punchermanager.web.dto;

import com.punchermanager.domain.UserRole;
import java.util.UUID;

public record LoginResponse(
    String token,
    UUID userId,
    String name,
    String email,
    UserRole role,
    String employeeId,
    UUID departmentId,
    UUID teamId) {}
