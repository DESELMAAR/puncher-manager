package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.NotificationService;
import com.punchermanager.service.SseNotificationBroadcaster;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.NotificationDto;
import com.punchermanager.web.dto.SendNotificationRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/notification")
public class NotificationController {

  private final NotificationService notificationService;
  private final UserContextService userContextService;
  private final SseNotificationBroadcaster broadcaster;

  public NotificationController(
      NotificationService notificationService,
      UserContextService userContextService,
      SseNotificationBroadcaster broadcaster) {
    this.notificationService = notificationService;
    this.userContextService = userContextService;
    this.broadcaster = broadcaster;
  }

  @PostMapping("/send")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public void send(HttpServletRequest http, @Valid @RequestBody SendNotificationRequest body) {
    User user = userContextService.requireCurrentUser(http);
    notificationService.sendToTeam(user, body);
  }

  @GetMapping("/my")
  public List<NotificationDto> my(HttpServletRequest http) {
    User user = userContextService.requireCurrentUser(http);
    return notificationService.myNotifications(user);
  }

  @PatchMapping("/{id}/read")
  public void markRead(HttpServletRequest http, @PathVariable UUID id) {
    User user = userContextService.requireCurrentUser(http);
    notificationService.markRead(user, id);
  }

  @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<SseEmitter> stream(HttpServletRequest http) {
    User user = userContextService.requireCurrentUser(http);
    SseEmitter emitter = broadcaster.subscribe(user.getId());
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .header("X-Accel-Buffering", "no")
        .body(emitter);
  }
}
