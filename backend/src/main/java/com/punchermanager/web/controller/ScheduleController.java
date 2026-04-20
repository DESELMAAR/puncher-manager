package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.ScheduleService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.ScheduleRespondRequest;
import com.punchermanager.web.dto.WeeklyScheduleResponse;
import com.punchermanager.web.dto.WeeklyScheduleUpsertRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {

  private final ScheduleService scheduleService;
  private final UserContextService userContextService;

  public ScheduleController(ScheduleService scheduleService, UserContextService userContextService) {
    this.scheduleService = scheduleService;
    this.userContextService = userContextService;
  }

  @GetMapping("/week")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER','EMPLOYEE')")
  public WeeklyScheduleResponse week(
      HttpServletRequest http,
      @RequestParam(required = false) UUID employeeId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
    User actor = userContextService.requireCurrentUser(http);
    UUID target = employeeId != null ? employeeId : actor.getId();
    return scheduleService.getWeek(actor, target, weekStart);
  }

  @PutMapping("/week")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public WeeklyScheduleResponse upsert(
      HttpServletRequest http, @Valid @RequestBody WeeklyScheduleUpsertRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return scheduleService.upsertWeek(actor, body);
  }

  @PostMapping("/{scheduleId}/send-confirmation")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public WeeklyScheduleResponse sendConfirmation(
      HttpServletRequest http, @PathVariable UUID scheduleId) {
    User actor = userContextService.requireCurrentUser(http);
    return scheduleService.markConfirmationSent(actor, scheduleId);
  }

  @PostMapping("/{scheduleId}/respond")
  @PreAuthorize("hasRole('EMPLOYEE')")
  public WeeklyScheduleResponse respond(
      HttpServletRequest http,
      @PathVariable UUID scheduleId,
      @Valid @RequestBody ScheduleRespondRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return scheduleService.respond(actor, scheduleId, body.getStatus(), body.getComment());
  }
}

