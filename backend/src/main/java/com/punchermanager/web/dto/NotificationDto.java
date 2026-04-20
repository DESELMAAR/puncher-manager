package com.punchermanager.web.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationDto(
    UUID id,
    UUID senderId,
    String senderName,
    String message,
    Instant createdAt,
    boolean read,
    UUID teamId) {}
