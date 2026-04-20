package com.punchermanager.web.controller;

import com.punchermanager.service.DepartmentService;
import com.punchermanager.web.dto.DepartmentRequest;
import com.punchermanager.web.dto.DepartmentResponse;
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
@RequestMapping("/api/departments")
public class DepartmentController {

  private final DepartmentService departmentService;

  public DepartmentController(DepartmentService departmentService) {
    this.departmentService = departmentService;
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

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  public void delete(@PathVariable UUID id) {
    departmentService.delete(id);
  }
}
