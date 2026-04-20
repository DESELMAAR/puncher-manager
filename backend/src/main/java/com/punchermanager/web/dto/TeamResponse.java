package com.punchermanager.web.dto;

import java.util.UUID;

public record TeamResponse(UUID id, String name, UUID departmentId, UUID teamLeaderId) {}
