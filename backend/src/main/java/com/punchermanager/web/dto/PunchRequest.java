package com.punchermanager.web.dto;

import com.punchermanager.domain.PunchType;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public class PunchRequest {

  @NotNull private PunchType type;

  private Instant timestamp;

  public PunchType getType() {
    return type;
  }

  public void setType(PunchType type) {
    this.type = type;
  }

  public Instant getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(Instant timestamp) {
    this.timestamp = timestamp;
  }
}
