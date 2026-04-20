package com.punchermanager.web.dto;

import com.punchermanager.domain.ScheduleConfirmationStatus;
import jakarta.validation.constraints.NotNull;

public class ScheduleRespondRequest {

  @NotNull private ScheduleConfirmationStatus status;

  private String comment;

  public ScheduleConfirmationStatus getStatus() {
    return status;
  }

  public void setStatus(ScheduleConfirmationStatus status) {
    this.status = status;
  }

  public String getComment() {
    return comment;
  }

  public void setComment(String comment) {
    this.comment = comment;
  }
}

