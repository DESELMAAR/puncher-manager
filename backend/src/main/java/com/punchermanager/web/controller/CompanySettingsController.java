package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.CompanySettingsService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.CompanySettingsDto;
import com.punchermanager.web.dto.CompanySettingsUpsertRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/company")
public class CompanySettingsController {

  private final CompanySettingsService companySettingsService;
  private final UserContextService userContextService;

  public CompanySettingsController(
      CompanySettingsService companySettingsService, UserContextService userContextService) {
    this.companySettingsService = companySettingsService;
    this.userContextService = userContextService;
  }

  @GetMapping
  @PreAuthorize(
      "hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER','EMPLOYEE')")
  public CompanySettingsDto get() {
    return companySettingsService.get();
  }

  @PutMapping
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public CompanySettingsDto upsert(HttpServletRequest http, @Valid @RequestBody CompanySettingsUpsertRequest body) {
    User actor = userContextService.requireCurrentUser(http);
    return companySettingsService.upsert(actor, body);
  }

  @DeleteMapping
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  public void delete(HttpServletRequest http) {
    User actor = userContextService.requireCurrentUser(http);
    companySettingsService.delete(actor);
  }
}

