package com.punchermanager.web.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class SendNotificationRequest {

  public enum TargetType {
    ALL_EMPLOYEES,
    DEPARTMENT,
    TEAM,
    EMPLOYEE
  }

  private TargetType targetType = TargetType.TEAM;

  private UUID departmentId;

  private UUID teamId;

  private UUID employeeUserId;

  @NotBlank private String message;

  public TargetType getTargetType() {
    return targetType;
  }

  public void setTargetType(TargetType targetType) {
    this.targetType = targetType;
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

  public UUID getEmployeeUserId() {
    return employeeUserId;
  }

  public void setEmployeeUserId(UUID employeeUserId) {
    this.employeeUserId = employeeUserId;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }
}
