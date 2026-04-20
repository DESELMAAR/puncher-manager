package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.TeamMembershipService;
import com.punchermanager.service.UserContextService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teams/{teamId}/members")
public class TeamMembershipController {

  private final TeamMembershipService teamMembershipService;
  private final UserContextService userContextService;

  public TeamMembershipController(
      TeamMembershipService teamMembershipService, UserContextService userContextService) {
    this.teamMembershipService = teamMembershipService;
    this.userContextService = userContextService;
  }

  @PostMapping("/{userId}")
  @PreAuthorize("hasRole('TEAM_LEADER')")
  public void add(HttpServletRequest http, @PathVariable UUID teamId, @PathVariable UUID userId) {
    User actor = userContextService.requireCurrentUser(http);
    teamMembershipService.addEmployee(actor, teamId, userId);
  }

  @DeleteMapping("/{userId}")
  @PreAuthorize("hasRole('TEAM_LEADER')")
  public void remove(
      HttpServletRequest http, @PathVariable UUID teamId, @PathVariable UUID userId) {
    User actor = userContextService.requireCurrentUser(http);
    teamMembershipService.removeEmployee(actor, teamId, userId);
  }
}
