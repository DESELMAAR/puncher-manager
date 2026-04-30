package com.punchermanager.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "departments")
public class Department {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "TEXT")
  private String description;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "admin_id")
  private User admin;

  /** Business earliest start-work hour (0-23), used for attendance indentation. */
  @Column(name = "business_first_start_hour")
  private Integer businessFirstStartHour;

  /** Business latest start-work hour (0-23), used for attendance indentation. */
  @Column(name = "business_last_start_hour")
  private Integer businessLastStartHour;

  /** Grace time (minutes) allowed after scheduled start before "late". */
  @Column(name = "late_grace_minutes")
  private Integer lateGraceMinutes;

  /** Allowed lunch duration (minutes). */
  @Column(name = "allowed_lunch_minutes")
  private Integer allowedLunchMinutes;

  /** Allowed total breaks duration (minutes) (BREAK1 + BREAK2). */
  @Column(name = "allowed_breaks_minutes")
  private Integer allowedBreaksMinutes;

  public Department() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

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

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public User getAdmin() {
    return admin;
  }

  public void setAdmin(User admin) {
    this.admin = admin;
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
