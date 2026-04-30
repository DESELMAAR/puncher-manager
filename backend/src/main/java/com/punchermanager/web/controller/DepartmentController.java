package com.punchermanager.web.controller;

import com.punchermanager.service.DepartmentService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.DepartmentDurationsRequest;
import com.punchermanager.web.dto.DepartmentRequest;
import com.punchermanager.web.dto.DepartmentResponse;
import com.punchermanager.web.dto.DepartmentGraceRequest;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
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
@RequestMapping("/api/departments")
public class DepartmentController {

  private final DepartmentService departmentService;
  private final UserContextService userContextService;

  public DepartmentController(DepartmentService departmentService, UserContextService userContextService) {
    this.departmentService = departmentService;
    this.userContextService = userContextService;
  }

  @GetMapping
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER','EMPLOYEE')")
  public List<DepartmentResponse> list() {
    return departmentService.listAll();
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public DepartmentResponse create(@Valid @RequestBody DepartmentRequest body) {
    return departmentService.create(body);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public DepartmentResponse update(
      @PathVariable UUID id, @Valid @RequestBody DepartmentRequest body) {
    return departmentService.update(id, body);
  }

  @PutMapping("/{id}/grace")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER')")
  public DepartmentResponse updateGrace(
      HttpServletRequest http, @PathVariable UUID id, @RequestBody DepartmentGraceRequest body) {
    var user = userContextService.requireCurrentUser(http);
    return departmentService.updateLateGraceMinutes(id, body.getLateGraceMinutes(), user);
  }

  @PutMapping("/{id}/durations")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER')")
  public DepartmentResponse updateDurations(
      HttpServletRequest http,
      @PathVariable UUID id,
      @RequestBody DepartmentDurationsRequest body) {
    var user = userContextService.requireCurrentUser(http);
    return departmentService.updateAllowedDurations(
        id, body.getAllowedLunchMinutes(), body.getAllowedBreaksMinutes(), user);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public void delete(@PathVariable UUID id) {
    departmentService.delete(id);
  }
}
