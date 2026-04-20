package com.punchermanager.service;

import com.punchermanager.domain.NotificationEntity;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.NotificationRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.NotificationDto;
import com.punchermanager.web.dto.SendNotificationRequest;
import com.punchermanager.web.exception.ApiException;
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

  public NotificationService(
      NotificationRepository notificationRepository,
      TeamRepository teamRepository,
      UserRepository userRepository,
      SseNotificationBroadcaster broadcaster) {
    this.notificationRepository = notificationRepository;
    this.teamRepository = teamRepository;
    this.userRepository = userRepository;
    this.broadcaster = broadcaster;
  }

  @Transactional
  public void sendToTeam(User sender, SendNotificationRequest req) {
    if (sender.getRole() != UserRole.TEAM_LEADER) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only team leaders can broadcast");
    }
    Team team =
        teamRepository
            .findByIdFetched(req.getTeamId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    if (!team.getTeamLeader().getId().equals(sender.getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Not your team");
    }
    List<User> recipients = userRepository.findEmployeesByTeamId(team.getId());
    for (User r : recipients) {
      NotificationEntity entity = new NotificationEntity();
      entity.setSender(sender);
      entity.setReceiver(r);
      entity.setTeam(null);
      entity.setMessage(req.getMessage());
      entity.setReadFlag(false);
      NotificationEntity saved = notificationRepository.save(entity);
      broadcaster.publish(r.getId(), "notification", toDto(saved));
    }
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
        n.getMessage(),
        n.getCreatedAt(),
        n.isReadFlag(),
        null);
  }
}
