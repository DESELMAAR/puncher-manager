package com.punchermanager.web.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class DepartmentRequest {

  @NotBlank private String name;

  private String description;

  private UUID adminId;

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
}
