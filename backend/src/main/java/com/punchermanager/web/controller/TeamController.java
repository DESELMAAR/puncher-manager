package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.TeamService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.TeamRequest;
import com.punchermanager.web.dto.TeamResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

  private final TeamService teamService;
  private final UserContextService userContextService;

  public TeamController(TeamService teamService, UserContextService userContextService) {
    this.teamService = teamService;
    this.userContextService = userContextService;
  }

  @GetMapping("/department/{departmentId}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public List<TeamResponse> byDepartment(
      HttpServletRequest http, @PathVariable UUID departmentId) {
    User actor = userContextService.requireCurrentUser(http);
    return teamService.listByDepartment(actor, departmentId);
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER')")
  public TeamResponse create(HttpServletRequest http, @Valid @RequestBody TeamRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return teamService.create(actor, body);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER')")
  public TeamResponse update(
      HttpServletRequest http, @PathVariable UUID id, @Valid @RequestBody TeamRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return teamService.update(actor, id, body);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER')")
  public void delete(HttpServletRequest http, @PathVariable UUID id) {
    User actor = userContextService.requireCurrentUser(http);
    teamService.delete(actor, id);
  }
}
