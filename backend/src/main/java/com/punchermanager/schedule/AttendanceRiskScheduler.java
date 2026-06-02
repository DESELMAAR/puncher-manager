package com.punchermanager.schedule;

import com.punchermanager.service.AttendanceRiskService;
import java.time.LocalDate;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AttendanceRiskScheduler {

  private static final Logger log = LoggerFactory.getLogger(AttendanceRiskScheduler.class);
  private static final ZoneId ZONE = ZoneId.systemDefault();

  private final AttendanceRiskService attendanceRiskService;

  public AttendanceRiskScheduler(AttendanceRiskService attendanceRiskService) {
    this.attendanceRiskService = attendanceRiskService;
  }

  /** Daily at 08:00 — after overnight absence evaluation (02:00). */
  @Scheduled(cron = "${puncher.attendance-risk.cron:0 0 8 * * *}")
  public void evaluateAttendanceRisk() {
    LocalDate today = LocalDate.now(ZONE);
    log.info("Starting scheduled attendance risk evaluation for {}", today);
    attendanceRiskService.evaluateAll(today);
  }
}
