package com.punchermanager.web.controller;

import com.punchermanager.service.PlanningService;
import com.punchermanager.web.dto.PlanningResponseDto;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/planning/mock")
public class PlanningMockController {

  private final PlanningService planningService;

  public PlanningMockController(PlanningService planningService) {
    this.planningService = planningService;
  }

  @GetMapping("/{employeeId}/{date}")
  public ResponseEntity<Map<String, Object>> mock(
      @PathVariable String employeeId,
      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    return planningService
        .getPlannedDay(employeeId, date)
        .map(this::toJson)
        .map(ResponseEntity::ok)
        .orElse(
            ResponseEntity.ok(
                Map.of("workingDay", false, "employeeId", employeeId, "date", date.toString())));
  }

  private Map<String, Object> toJson(PlanningResponseDto p) {
    Map<String, Object> m = new HashMap<>();
    m.put("employeeId", p.employeeId());
    m.put("date", p.date().toString());
    m.put("expectedStartTime", p.expectedStartTime().toString());
    m.put("expectedEndTime", p.expectedEndTime().toString());
    m.put("workingDay", p.workingDay());
    return m;
  }
}
