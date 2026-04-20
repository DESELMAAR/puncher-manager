package com.punchermanager.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class TeamRequest {

  @NotBlank private String name;

  @NotNull private UUID departmentId;

  @NotNull private UUID teamLeaderId;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public UUID getDepartmentId() {
    return departmentId;
  }

  public void setDepartmentId(UUID departmentId) {
    this.departmentId = departmentId;
  }

  public UUID getTeamLeaderId() {
    return teamLeaderId;
  }

  public void setTeamLeaderId(UUID teamLeaderId) {
    this.teamLeaderId = teamLeaderId;
  }
}
