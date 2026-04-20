package com.punchermanager.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class WeeklyScheduleUpsertRequest {

  @NotNull private UUID employeeId;

  @NotNull private LocalDate weekStart;

  @NotNull
  @Size(min = 7, max = 7)
  @Valid
  private List<WeeklyScheduleDayDto> days;

  public UUID getEmployeeId() {
    return employeeId;
  }

  public void setEmployeeId(UUID employeeId) {
    this.employeeId = employeeId;
  }

  public LocalDate getWeekStart() {
    return weekStart;
  }

  public void setWeekStart(LocalDate weekStart) {
    this.weekStart = weekStart;
  }

  public List<WeeklyScheduleDayDto> getDays() {
    return days;
  }

  public void setDays(List<WeeklyScheduleDayDto> days) {
    this.days = days;
  }
}

