package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.AttendanceService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.AttendanceRowDto;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

  private final AttendanceService attendanceService;
  private final UserContextService userContextService;

  public AttendanceController(
      AttendanceService attendanceService, UserContextService userContextService) {
    this.attendanceService = attendanceService;
    this.userContextService = userContextService;
  }

  @GetMapping("/team/{teamId}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public List<AttendanceRowDto> teamDay(
      HttpServletRequest http,
      @PathVariable UUID teamId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    User user = userContextService.requireCurrentUser(http);
    return attendanceService.teamAttendance(teamId, date, user);
  }

  @GetMapping(value = "/team/{teamId}/export", produces = "text/csv")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public ResponseEntity<byte[]> exportTeamCsv(
      HttpServletRequest http,
      @PathVariable UUID teamId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    User user = userContextService.requireCurrentUser(http);
    List<AttendanceRowDto> rows = attendanceService.teamAttendance(teamId, date, user);
    StringBuilder sb = new StringBuilder();
    sb.append("employeeId,name,date,status,expectedStart,actualStart,minutesLate,punchSummary\n");
    for (AttendanceRowDto r : rows) {
      String punches =
          r.punches() == null
              ? ""
              : r.punches().stream()
                  .map(p -> p.type() + "@" + p.punchedAt())
                  .reduce((a, b) -> a + " | " + b)
                  .orElse("");
      sb.append(
          String.join(
              ",",
              escape(r.employeeId()),
              escape(r.name()),
              date.toString(),
              r.status() != null ? r.status().name() : "",
              r.expectedStart() != null ? r.expectedStart().toString() : "",
              r.actualStart() != null ? r.actualStart().toString() : "",
              r.minutesLate() != null ? r.minutesLate().toString() : "",
              escape(punches)));
      sb.append('\n');
    }
    byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment()
                .filename("attendance-" + teamId + "-" + date + ".csv")
                .build()
                .toString())
        .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
        .body(bytes);
  }

  private static String escape(String s) {
    if (s == null) {
      return "";
    }
    String v = s.replace("\"", "\"\"");
    if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
      return "\"" + v + "\"";
    }
    return v;
  }
}
