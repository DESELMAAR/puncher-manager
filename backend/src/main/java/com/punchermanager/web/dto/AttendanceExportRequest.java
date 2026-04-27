package com.punchermanager.web.dto;

import com.punchermanager.service.AttendanceExportService.Scope;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class AttendanceExportRequest {

  @NotNull private Scope scope = Scope.TEAM;

  private UUID departmentId;

  private UUID teamId;

  /** If provided, export this exact range (inclusive). */
  private LocalDate from;

  private LocalDate to;

  /** If range is not provided, export this date (single day). */
  private LocalDate date;

  /** Optional: restrict export to these employees (matches client-side filtering). */
  private List<UUID> filterUserIds;

  public Scope getScope() {
    return scope;
  }

  public void setScope(Scope scope) {
    this.scope = scope;
  }

  public UUID getDepartmentId() {
    return departmentId;
  }

  public void setDepartmentId(UUID departmentId) {
    this.departmentId = departmentId;
  }

  public UUID getTeamId() {
    return teamId;
  }

  public void setTeamId(UUID teamId) {
    this.teamId = teamId;
  }

  public LocalDate getFrom() {
    return from;
  }

  public void setFrom(LocalDate from) {
    this.from = from;
  }

  public LocalDate getTo() {
    return to;
  }

  public void setTo(LocalDate to) {
    this.to = to;
  }

  public LocalDate getDate() {
    return date;
  }

  public void setDate(LocalDate date) {
    this.date = date;
  }

  public List<UUID> getFilterUserIds() {
    return filterUserIds;
  }

  public void setFilterUserIds(List<UUID> filterUserIds) {
    this.filterUserIds = filterUserIds;
  }
}

