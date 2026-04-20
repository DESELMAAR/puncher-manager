package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.PunchService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.PunchRequest;
import com.punchermanager.web.dto.PunchResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/punch")
public class PunchController {

  private final PunchService punchService;
  private final UserContextService userContextService;

  public PunchController(PunchService punchService, UserContextService userContextService) {
    this.punchService = punchService;
    this.userContextService = userContextService;
  }

  @PostMapping
  @PreAuthorize("hasRole('EMPLOYEE')")
  public PunchResponse punch(HttpServletRequest http, @Valid @RequestBody PunchRequest body) {
    User user = userContextService.requireCurrentUser(http);
    return punchService.punch(user, body);
  }

  @GetMapping("/my-history")
  @PreAuthorize("hasRole('EMPLOYEE')")
  public List<PunchResponse> myHistory(
      HttpServletRequest http,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    User user = userContextService.requireCurrentUser(http);
    return punchService.myHistory(user, from, to);
  }
}
