package com.punchermanager.service;

import com.punchermanager.domain.NotificationEntity;
import com.punchermanager.domain.NotificationType;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.DepartmentRepository;
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
  private final DepartmentRepository departmentRepository;
  private final TeamRepository teamRepository;
  private final UserRepository userRepository;
  private final SseNotificationBroadcaster broadcaster;
  private final ObjectMapper objectMapper;

  public NotificationService(
      NotificationRepository notificationRepository,
      DepartmentRepository departmentRepository,
      TeamRepository teamRepository,
      UserRepository userRepository,
      SseNotificationBroadcaster broadcaster,
      ObjectMapper objectMapper) {
    this.notificationRepository = notificationRepository;
    this.departmentRepository = departmentRepository;
    this.teamRepository = teamRepository;
    this.userRepository = userRepository;
    this.broadcaster = broadcaster;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void sendToTeam(User sender, SendNotificationRequest req) {
    if (req.getTargetType() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Missing targetType");
    }
    if (req.getMessage() == null || req.getMessage().trim().isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Message is required");
    }

    List<User> recipients;
    switch (req.getTargetType()) {
      case ALL_EMPLOYEES -> {
        if (sender.getRole() != UserRole.SUPER_ADMIN && sender.getRole() != UserRole.ADMIN) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Only SUPER_ADMIN/ADMIN can message all employees");
        }
        recipients = userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE);
      }
      case DEPARTMENT -> {
        if (req.getDepartmentId() == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "departmentId is required");
        }
        departmentRepository
            .findById(req.getDepartmentId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Department not found"));
        if (sender.getRole() == UserRole.DEPT_MANAGER) {
          if (sender.getDepartment() == null
              || !sender.getDepartment().getId().equals(req.getDepartmentId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your department");
          }
        } else if (sender.getRole() != UserRole.SUPER_ADMIN && sender.getRole() != UserRole.ADMIN) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        recipients = userRepository.findByDepartmentIdAndRole(req.getDepartmentId(), UserRole.EMPLOYEE);
      }
      case TEAM -> {
        if (req.getTeamId() == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "teamId is required");
        }
        Team team =
            teamRepository
                .findByIdFetched(req.getTeamId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
        switch (sender.getRole()) {
          case SUPER_ADMIN, ADMIN -> {
            // ok
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
          default -> throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        recipients = userRepository.findEmployeesByTeamId(team.getId());
      }
      case EMPLOYEE -> {
        if (req.getEmployeeUserId() == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "employeeUserId is required");
        }
        User target =
            userRepository
                .findById(req.getEmployeeUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
        if (target.getRole() != UserRole.EMPLOYEE) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "Target must be an EMPLOYEE");
        }
        switch (sender.getRole()) {
          case SUPER_ADMIN, ADMIN -> {}
          case DEPT_MANAGER -> {
            if (sender.getDepartment() == null
                || target.getDepartment() == null
                || !sender.getDepartment().getId().equals(target.getDepartment().getId())) {
              throw new ApiException(HttpStatus.FORBIDDEN, "Not your department");
            }
          }
          case TEAM_LEADER -> {
            if (sender.getTeam() == null
                || target.getTeam() == null
                || !sender.getTeam().getId().equals(target.getTeam().getId())) {
              throw new ApiException(HttpStatus.FORBIDDEN, "Not your team");
            }
          }
          default -> throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        recipients = List.of(target);
      }
      default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid targetType");
    }

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
