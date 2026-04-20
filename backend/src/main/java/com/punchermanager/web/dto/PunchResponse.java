package com.punchermanager.web.dto;

import com.punchermanager.domain.PunchType;
import java.time.Instant;
import java.util.UUID;

public record PunchResponse(UUID id, PunchType type, Instant punchedAt) {}
