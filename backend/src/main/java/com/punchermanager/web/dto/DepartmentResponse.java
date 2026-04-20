package com.punchermanager.web.dto;

import java.time.Instant;
import java.util.UUID;

public record DepartmentResponse(
    UUID id, String name, String description, Instant createdAt, UUID adminId) {}
