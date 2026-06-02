package com.punchermanager.domain;

public enum AttendanceRiskRule {
  LATE_3_IN_7(
      7,
      3,
      AttendanceStatus.LATE,
      AttendanceRiskLevel.WARNING,
      true,
      false,
      "Late 3 times in 7 days"),
  LATE_5_IN_30(
      30,
      5,
      AttendanceStatus.LATE,
      AttendanceRiskLevel.MEDIUM,
      true,
      false,
      "Late 5 times in 30 days"),
  LATE_10_IN_30(
      30,
      10,
      AttendanceStatus.LATE,
      AttendanceRiskLevel.HIGH,
      true,
      true,
      "Late 10+ times in 30 days"),
  ABSENT_2_IN_30(
      30,
      2,
      AttendanceStatus.ABSENT,
      AttendanceRiskLevel.WARNING,
      true,
      false,
      "Absent 2 times in 30 days"),
  ABSENT_4_IN_30(
      30,
      4,
      AttendanceStatus.ABSENT,
      AttendanceRiskLevel.HIGH,
      false,
      true,
      "Absent 4+ times in 30 days");

  private final int windowDays;
  private final int threshold;
  private final AttendanceStatus status;
  private final AttendanceRiskLevel level;
  private final boolean notifyEmployee;
  private final boolean notifyManager;
  private final String label;

  AttendanceRiskRule(
      int windowDays,
      int threshold,
      AttendanceStatus status,
      AttendanceRiskLevel level,
      boolean notifyEmployee,
      boolean notifyManager,
      String label) {
    this.windowDays = windowDays;
    this.threshold = threshold;
    this.status = status;
    this.level = level;
    this.notifyEmployee = notifyEmployee;
    this.notifyManager = notifyManager;
    this.label = label;
  }

  public int windowDays() {
    return windowDays;
  }

  public int threshold() {
    return threshold;
  }

  public AttendanceStatus status() {
    return status;
  }

  public AttendanceRiskLevel level() {
    return level;
  }

  public boolean notifyEmployee() {
    return notifyEmployee;
  }

  public boolean notifyManager() {
    return notifyManager;
  }

  public String label() {
    return label;
  }
}
