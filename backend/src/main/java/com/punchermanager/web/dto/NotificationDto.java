package com.punchermanager.web.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationDto(
    UUID id,
    UUID senderId,
    String senderName,
    String type,
    String message,
    String payloadJson,
    Instant createdAt,
    boolean read,
    UUID teamId) {}
