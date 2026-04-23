package com.punchermanager.web.dto;

import java.time.Instant;
import java.util.UUID;

public record CompanySettingsDto(
    UUID id,
    String companyName,
    String postalAddress,
    String departmentLabel,
    String siteLocation,
    Instant updatedAt) {}

