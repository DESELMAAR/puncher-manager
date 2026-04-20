package com.punchermanager.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "punches")
public class Punch {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Enumerated(EnumType.STRING)
  @Column(name = "punch_type", nullable = false)
  private PunchType punchType;

  @Column(name = "punched_at", nullable = false)
  private Instant punchedAt;

  public Punch() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  public PunchType getPunchType() {
    return punchType;
  }

  public void setPunchType(PunchType punchType) {
    this.punchType = punchType;
  }

  public Instant getPunchedAt() {
    return punchedAt;
  }

  public void setPunchedAt(Instant punchedAt) {
    this.punchedAt = punchedAt;
  }
}
