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
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "attendance_risk_alerts")
public class AttendanceRiskAlert {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "employee_user_id", nullable = false)
  private User employee;

  @Enumerated(EnumType.STRING)
  @Column(name = "rule_code", nullable = false)
  private AttendanceRiskRule ruleCode;

  @Enumerated(EnumType.STRING)
  @Column(name = "risk_level", nullable = false)
  private AttendanceRiskLevel riskLevel;

  @Column(name = "window_start", nullable = false)
  private LocalDate windowStart;

  @Column(name = "window_end", nullable = false)
  private LocalDate windowEnd;

  @Column(name = "metric_count", nullable = false)
  private int metricCount;

  @Column(name = "employee_notified", nullable = false)
  private boolean employeeNotified;

  @Column(name = "manager_notified", nullable = false)
  private boolean managerNotified;

  @Column(name = "email_sent", nullable = false)
  private boolean emailSent;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public AttendanceRiskAlert() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public User getEmployee() {
    return employee;
  }

  public void setEmployee(User employee) {
    this.employee = employee;
  }

  public AttendanceRiskRule getRuleCode() {
    return ruleCode;
  }

  public void setRuleCode(AttendanceRiskRule ruleCode) {
    this.ruleCode = ruleCode;
  }

  public AttendanceRiskLevel getRiskLevel() {
    return riskLevel;
  }

  public void setRiskLevel(AttendanceRiskLevel riskLevel) {
    this.riskLevel = riskLevel;
  }

  public LocalDate getWindowStart() {
    return windowStart;
  }

  public void setWindowStart(LocalDate windowStart) {
    this.windowStart = windowStart;
  }

  public LocalDate getWindowEnd() {
    return windowEnd;
  }

  public void setWindowEnd(LocalDate windowEnd) {
    this.windowEnd = windowEnd;
  }

  public int getMetricCount() {
    return metricCount;
  }

  public void setMetricCount(int metricCount) {
    this.metricCount = metricCount;
  }

  public boolean isEmployeeNotified() {
    return employeeNotified;
  }

  public void setEmployeeNotified(boolean employeeNotified) {
    this.employeeNotified = employeeNotified;
  }

  public boolean isManagerNotified() {
    return managerNotified;
  }

  public void setManagerNotified(boolean managerNotified) {
    this.managerNotified = managerNotified;
  }

  public boolean isEmailSent() {
    return emailSent;
  }

  public void setEmailSent(boolean emailSent) {
    this.emailSent = emailSent;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
