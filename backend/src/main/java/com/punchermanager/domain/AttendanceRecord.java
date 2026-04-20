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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(
    name = "attendance_records",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_attendance_user_date",
            columnNames = {"user_id", "record_date"}))
public class AttendanceRecord {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "employee_id", nullable = false)
  private String employeeId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(name = "record_date", nullable = false)
  private LocalDate recordDate;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private AttendanceStatus status;

  @Column(name = "expected_start")
  private LocalTime expectedStart;

  @Column(name = "actual_start")
  private LocalTime actualStart;

  @Column(name = "minutes_late")
  private Integer minutesLate;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public AttendanceRecord() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getEmployeeId() {
    return employeeId;
  }

  public void setEmployeeId(String employeeId) {
    this.employeeId = employeeId;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  public LocalDate getRecordDate() {
    return recordDate;
  }

  public void setRecordDate(LocalDate recordDate) {
    this.recordDate = recordDate;
  }

  public AttendanceStatus getStatus() {
    return status;
  }

  public void setStatus(AttendanceStatus status) {
    this.status = status;
  }

  public LocalTime getExpectedStart() {
    return expectedStart;
  }

  public void setExpectedStart(LocalTime expectedStart) {
    this.expectedStart = expectedStart;
  }

  public LocalTime getActualStart() {
    return actualStart;
  }

  public void setActualStart(LocalTime actualStart) {
    this.actualStart = actualStart;
  }

  public Integer getMinutesLate() {
    return minutesLate;
  }

  public void setMinutesLate(Integer minutesLate) {
    this.minutesLate = minutesLate;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
