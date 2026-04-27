package com.punchermanager.service;

import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.web.dto.AttendanceRowDto;
import com.punchermanager.web.exception.ApiException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AttendanceExportService {

  public enum Scope {
    ALL,
    DEPARTMENT,
    TEAM
  }

  private final AttendanceService attendanceService;
  private final TeamRepository teamRepository;

  public AttendanceExportService(AttendanceService attendanceService, TeamRepository teamRepository) {
    this.attendanceService = attendanceService;
    this.teamRepository = teamRepository;
  }

  public byte[] exportXlsx(
      Scope scope,
      UUID departmentId,
      UUID teamId,
      LocalDate from,
      LocalDate to,
      List<UUID> filterUserIds,
      User requester,
      ZoneId zone) {
    List<AttendanceRowDto> rows = resolveRows(scope, departmentId, teamId, from, to, requester, zone);
    if (filterUserIds != null && !filterUserIds.isEmpty()) {
      Set<UUID> allowed = filterUserIds.stream().collect(Collectors.toSet());
      rows = rows.stream().filter(r -> allowed.contains(r.userId())).toList();
    }
    rows =
        rows.stream()
            .sorted(
                Comparator.comparing(AttendanceRowDto::recordDate)
                    .thenComparing(r -> nullSafe(r.departmentName()))
                    .thenComparing(r -> nullSafe(r.teamName()))
                    .thenComparing(r -> nullSafe(r.employeeId())))
            .toList();

    try (XSSFWorkbook wb = new XSSFWorkbook()) {
      Sheet sheet = wb.createSheet("Attendance");

      Font headerFont = wb.createFont();
      headerFont.setBold(true);
      CellStyle headerStyle = wb.createCellStyle();
      headerStyle.setFont(headerFont);

      String[] headers =
          new String[] {
            "Date",
            "Department",
            "Team",
            "Employee ID",
            "Employee name",
            "Status",
            "Expected start",
            "Actual start",
            "Minutes late",
            "Dept manager",
            "Team leader",
            "Schedule OK",
            "Schedule note",
            "Punches"
          };
      Row hr = sheet.createRow(0);
      for (int i = 0; i < headers.length; i++) {
        Cell c = hr.createCell(i);
        c.setCellValue(headers[i]);
        c.setCellStyle(headerStyle);
      }
      // Keep header visible while scrolling
      sheet.createFreezePane(0, 1);

      int rIdx = 1;
      for (AttendanceRowDto r : rows) {
        Row row = sheet.createRow(rIdx++);
        int c = 0;
        row.createCell(c++).setCellValue(r.recordDate() != null ? r.recordDate().toString() : "");
        row.createCell(c++).setCellValue(nullSafe(r.departmentName()));
        row.createCell(c++).setCellValue(nullSafe(r.teamName()));
        row.createCell(c++).setCellValue(nullSafe(r.employeeId()));
        row.createCell(c++).setCellValue(nullSafe(r.name()));
        row.createCell(c++).setCellValue(r.status() != null ? r.status().name() : "");
        row.createCell(c++).setCellValue(r.expectedStart() != null ? r.expectedStart().toString() : "");
        row.createCell(c++).setCellValue(r.actualStart() != null ? r.actualStart().toString() : "");
        row.createCell(c++).setCellValue(r.minutesLate() != null ? r.minutesLate() : 0);
        row.createCell(c++).setCellValue(nullSafe(r.deptManagerName()));
        row.createCell(c++).setCellValue(nullSafe(r.teamLeaderName()));
        row.createCell(c++).setCellValue(r.scheduleVsPlanOk() != null ? r.scheduleVsPlanOk().toString() : "");
        row.createCell(c++).setCellValue(nullSafe(r.scheduleVsPlanNote()));
        row.createCell(c++).setCellValue(punchSummary(r));
      }

      // Enable per-column filtering in Excel
      int lastRow = Math.max(0, rows.size());
      sheet.setAutoFilter(new CellRangeAddress(0, lastRow, 0, headers.length - 1));

      for (int i = 0; i < headers.length; i++) {
        sheet.autoSizeColumn(i);
      }

      ByteArrayOutputStream out = new ByteArrayOutputStream();
      wb.write(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate Excel file");
    }
  }

  private List<AttendanceRowDto> resolveRows(
      Scope scope,
      UUID departmentId,
      UUID teamId,
      LocalDate from,
      LocalDate to,
      User requester,
      ZoneId zone) {
    return switch (scope) {
      case TEAM -> {
        if (teamId == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "teamId is required");
        }
        yield attendanceService.teamAttendanceRange(teamId, from, to, requester, zone);
      }
      case DEPARTMENT -> {
        UUID dept =
            requester.getRole() == UserRole.SUPER_ADMIN || requester.getRole() == UserRole.ADMIN
                ? departmentId
                : (requester.getDepartment() != null ? requester.getDepartment().getId() : null);
        if (dept == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "departmentId is required");
        }
        yield attendanceService.departmentAttendanceRange(dept, from, to, requester, zone);
      }
      case ALL -> {
        if (requester.getRole() == UserRole.SUPER_ADMIN || requester.getRole() == UserRole.ADMIN) {
          yield attendanceService.allAttendanceRange(from, to, requester, zone);
        }
        // For DEPT_MANAGER / TEAM_LEADER: treat ALL as "my department"
        if (requester.getDepartment() == null) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "No department on user");
        }
        yield attendanceService.departmentAttendanceRange(
            requester.getDepartment().getId(), from, to, requester, zone);
      }
    };
  }

  private static String nullSafe(String s) {
    return s == null ? "" : s;
  }

  private static String punchSummary(AttendanceRowDto r) {
    if (r.punches() == null || r.punches().isEmpty()) return "";
    List<String> parts = new ArrayList<>();
    for (var p : r.punches()) {
      parts.add(p.type().name() + "@" + p.punchedAt());
    }
    return String.join(" | ", parts);
  }
}

