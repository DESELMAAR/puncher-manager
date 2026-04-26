package com.punchermanager.service;

import com.punchermanager.domain.NotificationEntity;
import com.punchermanager.domain.NotificationType;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.NotificationRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.NotificationDto;
import com.punchermanager.web.dto.SendNotificationRequest;
import com.punchermanager.web.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

  private final NotificationRepository notificationRepository;
  private final TeamRepository teamRepository;
  private final UserRepository userRepository;
  private final SseNotificationBroadcaster broadcaster;
  private final ObjectMapper objectMapper;

  public NotificationService(
      NotificationRepository notificationRepository,
      TeamRepository teamRepository,
      UserRepository userRepository,
      SseNotificationBroadcaster broadcaster,
      ObjectMapper objectMapper) {
    this.notificationRepository = notificationRepository;
    this.teamRepository = teamRepository;
    this.userRepository = userRepository;
    this.broadcaster = broadcaster;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void sendToTeam(User sender, SendNotificationRequest req) {
    Team team =
        teamRepository
            .findByIdFetched(req.getTeamId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));

    switch (sender.getRole()) {
      case SUPER_ADMIN, ADMIN -> {
        // Can message any team.
      }
      case DEPT_MANAGER -> {
        if (sender.getDepartment() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No department scope");
        }
        if (team.getDepartment() == null
            || !team.getDepartment().getId().equals(sender.getDepartment().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not your department");
        }
      }
      case TEAM_LEADER -> {
        if (!team.getTeamLeader().getId().equals(sender.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not your team");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed to broadcast");
    }

    List<User> recipients = userRepository.findEmployeesByTeamId(team.getId());
    for (User r : recipients) {
      NotificationEntity saved =
          createAndPublish(sender, r, NotificationType.MESSAGE, req.getMessage(), null);
      broadcaster.publish(r.getId(), "notification", toDto(saved));
    }
  }

  @Transactional
  public NotificationEntity sendScheduleConfirm(User sender, User employee, Object payload) {
    return createAndPublish(
        sender,
        employee,
        NotificationType.SCHEDULE_CONFIRM,
        "Please confirm your weekly schedule.",
        payload);
  }

  @Transactional
  public NotificationEntity sendScheduleResponse(User sender, User manager, String message, Object payload) {
    return createAndPublish(sender, manager, NotificationType.SCHEDULE_RESPONSE, message, payload);
  }

  private NotificationEntity createAndPublish(
      User sender, User receiver, NotificationType type, String message, Object payload) {
    NotificationEntity entity = new NotificationEntity();
    entity.setSender(sender);
    entity.setReceiver(receiver);
    entity.setTeam(null);
    entity.setNotificationType(type);
    entity.setMessage(message);
    entity.setReadFlag(false);
    if (payload != null) {
      try {
        entity.setPayloadJson(objectMapper.writeValueAsString(payload));
      } catch (Exception e) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Could not serialize notification payload");
      }
    } else {
      entity.setPayloadJson(null);
    }
    NotificationEntity saved = notificationRepository.save(entity);
    broadcaster.publish(receiver.getId(), "notification", toDto(saved));
    return saved;
  }

  @Transactional(readOnly = true)
  public List<NotificationDto> myNotifications(User user) {
    return notificationRepository.findByReceiverIdOrderByCreatedAtDesc(user.getId()).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional
  public void markRead(User user, UUID notificationId) {
    NotificationEntity n =
        notificationRepository
            .findById(notificationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found"));
    if (n.getReceiver() == null || !n.getReceiver().getId().equals(user.getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Cannot update this notification");
    }
    n.setReadFlag(true);
    notificationRepository.save(n);
  }

  private NotificationDto toDto(NotificationEntity n) {
    return new NotificationDto(
        n.getId(),
        n.getSender().getId(),
        n.getSender().getName(),
        n.getNotificationType() != null ? n.getNotificationType().name() : NotificationType.MESSAGE.name(),
        n.getMessage(),
        n.getPayloadJson(),
        n.getCreatedAt(),
        n.isReadFlag(),
        null);
  }
}
