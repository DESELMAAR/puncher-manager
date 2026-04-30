package com.punchermanager.web.dto;

public class DepartmentDurationsRequest {
  private Integer allowedLunchMinutes;
  private Integer allowedBreaksMinutes;

  public Integer getAllowedLunchMinutes() {
    return allowedLunchMinutes;
  }

  public void setAllowedLunchMinutes(Integer allowedLunchMinutes) {
    this.allowedLunchMinutes = allowedLunchMinutes;
  }

  public Integer getAllowedBreaksMinutes() {
    return allowedBreaksMinutes;
  }

  public void setAllowedBreaksMinutes(Integer allowedBreaksMinutes) {
    this.allowedBreaksMinutes = allowedBreaksMinutes;
  }
}

