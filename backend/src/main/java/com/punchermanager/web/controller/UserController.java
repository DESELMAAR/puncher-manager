package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.UserAdminService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.UserResponse;
import com.punchermanager.web.dto.UserUpsertRequest;
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
@RequestMapping("/api/users")
public class UserController {

  private final UserAdminService userAdminService;
  private final UserContextService userContextService;

  public UserController(UserAdminService userAdminService, UserContextService userContextService) {
    this.userAdminService = userAdminService;
    this.userContextService = userContextService;
  }

  @GetMapping
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public List<UserResponse> list(HttpServletRequest http) {
    User actor = userContextService.requireCurrentUser(http);
    return userAdminService.list(actor);
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public UserResponse create(HttpServletRequest http, @Valid @RequestBody UserUpsertRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return userAdminService.create(actor, body);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public UserResponse update(
      HttpServletRequest http, @PathVariable UUID id, @Valid @RequestBody UserUpsertRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return userAdminService.update(actor, id, body);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public void delete(HttpServletRequest http, @PathVariable UUID id) {
    User actor = userContextService.requireCurrentUser(http);
    userAdminService.delete(actor, id);
  }
}
