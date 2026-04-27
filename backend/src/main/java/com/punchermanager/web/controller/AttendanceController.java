package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.service.AttendanceService;
import com.punchermanager.service.AttendanceExportService;
import com.punchermanager.service.AttendanceExportService.Scope;
import com.punchermanager.service.PunchService;
import com.punchermanager.service.UserContextService;
import com.punchermanager.web.dto.AttendanceOverviewGroupDto;
import com.punchermanager.web.dto.AttendanceExportRequest;
import com.punchermanager.web.dto.AttendanceRowDto;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

  private final AttendanceService attendanceService;
  private final AttendanceExportService attendanceExportService;
  private final UserContextService userContextService;

  public AttendanceController(
      AttendanceService attendanceService,
      AttendanceExportService attendanceExportService,
      UserContextService userContextService) {
    this.attendanceService = attendanceService;
    this.attendanceExportService = attendanceExportService;
    this.userContextService = userContextService;
  }

  @GetMapping("/team/{teamId}")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public List<AttendanceRowDto> teamDay(
      HttpServletRequest http,
      @PathVariable UUID teamId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    User user = userContextService.requireCurrentUser(http);
    ZoneId zone = PunchService.resolveClientZone(http.getHeader("X-Client-Timezone"));
    if (from != null || to != null) {
      LocalDate f = from != null ? from : to;
      LocalDate t = to != null ? to : from;
      return attendanceService.teamAttendanceRange(teamId, f, t, user, zone);
    }
    if (date == null) {
      throw new com.punchermanager.web.exception.ApiException(
          org.springframework.http.HttpStatus.BAD_REQUEST, "date is required");
    }
    return attendanceService.teamAttendance(teamId, date, user, zone);
  }

  @GetMapping("/overview")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public List<AttendanceOverviewGroupDto> overview(
      HttpServletRequest http,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    User user = userContextService.requireCurrentUser(http);
    ZoneId zone = PunchService.resolveClientZone(http.getHeader("X-Client-Timezone"));
    if (from != null || to != null) {
      LocalDate f = from != null ? from : to;
      LocalDate t = to != null ? to : from;
      return attendanceService.overviewRange(f, t, user, zone);
    }
    if (date == null) {
      throw new com.punchermanager.web.exception.ApiException(
          org.springframework.http.HttpStatus.BAD_REQUEST, "date is required");
    }
    return attendanceService.overview(date, user, zone);
  }

  @GetMapping(value = "/team/{teamId}/export", produces = "text/csv")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public ResponseEntity<byte[]> exportTeamCsv(
      HttpServletRequest http,
      @PathVariable UUID teamId,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    User user = userContextService.requireCurrentUser(http);
    ZoneId zone = PunchService.resolveClientZone(http.getHeader("X-Client-Timezone"));
    List<AttendanceRowDto> rows = attendanceService.teamAttendance(teamId, date, user, zone);
    StringBuilder sb = new StringBuilder();
    sb.append(
        "employeeId,name,date,status,expectedStart,actualStart,minutesLate,punchSummary,scheduleVsPlanOk,scheduleVsPlanNote\n");
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
              escape(punches),
              r.scheduleVsPlanOk() != null ? r.scheduleVsPlanOk().toString() : "",
              escape(r.scheduleVsPlanNote())));
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

  @GetMapping(
      value = "/export.xlsx",
      produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public ResponseEntity<byte[]> exportExcel(
      HttpServletRequest http,
      @RequestParam(required = false) Scope scope,
      @RequestParam(required = false) UUID departmentId,
      @RequestParam(required = false) UUID teamId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    User user = userContextService.requireCurrentUser(http);
    ZoneId zone = PunchService.resolveClientZone(http.getHeader("X-Client-Timezone"));

    Scope s = scope != null ? scope : Scope.TEAM;
    LocalDate f;
    LocalDate t;
    if (from != null || to != null) {
      f = from != null ? from : to;
      t = to != null ? to : from;
    } else {
      if (date == null) {
        throw new com.punchermanager.web.exception.ApiException(
            org.springframework.http.HttpStatus.BAD_REQUEST, "date is required");
      }
      f = date;
      t = date;
    }

    byte[] bytes =
        attendanceExportService.exportXlsx(s, departmentId, teamId, f, t, null, user, zone);
    String filename = "attendance-" + s.name().toLowerCase() + "-" + f + "-to-" + t + ".xlsx";
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(filename).build().toString())
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(bytes);
  }

  @PostMapping(
      value = "/export.xlsx",
      produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','DEPT_MANAGER','TEAM_LEADER')")
  public ResponseEntity<byte[]> exportExcelPost(
      HttpServletRequest http, @Valid @RequestBody AttendanceExportRequest body) {
    User user = userContextService.requireCurrentUser(http);
    ZoneId zone = PunchService.resolveClientZone(http.getHeader("X-Client-Timezone"));

    Scope s = body.getScope() != null ? body.getScope() : Scope.TEAM;
    LocalDate f;
    LocalDate t;
    if (body.getFrom() != null || body.getTo() != null) {
      f = body.getFrom() != null ? body.getFrom() : body.getTo();
      t = body.getTo() != null ? body.getTo() : body.getFrom();
    } else {
      if (body.getDate() == null) {
        throw new com.punchermanager.web.exception.ApiException(
            org.springframework.http.HttpStatus.BAD_REQUEST, "date is required");
      }
      f = body.getDate();
      t = body.getDate();
    }

    byte[] bytes =
        attendanceExportService.exportXlsx(
            s,
            body.getDepartmentId(),
            body.getTeamId(),
            f,
            t,
            body.getFilterUserIds(),
            user,
            zone);
    String filename = "attendance-" + s.name().toLowerCase() + "-" + f + "-to-" + t + ".xlsx";
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(filename).build().toString())
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
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
