package com.punchermanager.web.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class DepartmentRequest {

  @NotBlank private String name;

  private String description;

  private UUID adminId;

  /** Earliest start-work hour (0-23). Optional. */
  private Integer businessFirstStartHour;

  /** Latest start-work hour (0-23). Optional. */
  private Integer businessLastStartHour;

  /** Grace time (minutes) allowed after scheduled start before "late". Optional. */
  private Integer lateGraceMinutes;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public UUID getAdminId() {
    return adminId;
  }

  public void setAdminId(UUID adminId) {
    this.adminId = adminId;
  }

  public Integer getBusinessFirstStartHour() {
    return businessFirstStartHour;
  }

  public void setBusinessFirstStartHour(Integer businessFirstStartHour) {
    this.businessFirstStartHour = businessFirstStartHour;
  }

  public Integer getBusinessLastStartHour() {
    return businessLastStartHour;
  }

  public void setBusinessLastStartHour(Integer businessLastStartHour) {
    this.businessLastStartHour = businessLastStartHour;
  }

  public Integer getLateGraceMinutes() {
    return lateGraceMinutes;
  }

  public void setLateGraceMinutes(Integer lateGraceMinutes) {
    this.lateGraceMinutes = lateGraceMinutes;
  }
}
