package com.punchermanager.service;

import com.punchermanager.domain.AttendanceRiskAlert;
import com.punchermanager.domain.AttendanceRiskLevel;
import com.punchermanager.domain.AttendanceRiskRule;
import com.punchermanager.domain.AttendanceStatus;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.AttendanceRecordRepository;
import com.punchermanager.repository.AttendanceRiskAlertRepository;
import com.punchermanager.repository.UserRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AttendanceRiskService {

  private static final Logger log = LoggerFactory.getLogger(AttendanceRiskService.class);
  private static final ZoneId ZONE = ZoneId.systemDefault();

  private final UserRepository userRepository;
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final AttendanceRiskAlertRepository attendanceRiskAlertRepository;
  private final NotificationService notificationService;
  private final MailService mailService;

  @Value("${puncher.attendance-risk.enabled:true}")
  private boolean enabled;

  public AttendanceRiskService(
      UserRepository userRepository,
      AttendanceRecordRepository attendanceRecordRepository,
      AttendanceRiskAlertRepository attendanceRiskAlertRepository,
      NotificationService notificationService,
      MailService mailService) {
    this.userRepository = userRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.attendanceRiskAlertRepository = attendanceRiskAlertRepository;
    this.notificationService = notificationService;
    this.mailService = mailService;
  }

  /** Evaluates all active employees against attendance risk rules for {@code asOf}. */
  @Transactional
  public int evaluateAll(LocalDate asOf) {
    if (!enabled) {
      log.debug("Attendance risk evaluation disabled");
      return 0;
    }
    User systemSender = resolveSystemSender();
    if (systemSender == null) {
      log.warn("No SUPER_ADMIN/ADMIN user found; skipping attendance risk evaluation");
      return 0;
    }

    List<User> employees =
        userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE);
    int alertsCreated = 0;
    for (User employee : employees) {
      User loaded =
          userRepository.findByIdWithContext(employee.getId()).orElse(employee);
      alertsCreated += evaluateEmployee(systemSender, loaded, asOf);
    }
    log.info("Attendance risk evaluation for {}: {} new alert(s)", asOf, alertsCreated);
    return alertsCreated;
  }

  int evaluateEmployee(User systemSender, User employee, LocalDate asOf) {
    int created = 0;
    for (AttendanceRiskRule rule : AttendanceRiskRule.values()) {
      if (tryTriggerRule(systemSender, employee, asOf, rule)) {
        created++;
      }
    }
    return created;
  }

  private boolean tryTriggerRule(
      User systemSender, User employee, LocalDate asOf, AttendanceRiskRule rule) {
    LocalDate windowStart = asOf.minusDays(rule.windowDays() - 1L);
    LocalDate windowEnd = asOf;

    java.time.Instant cooldownSince =
        windowEnd.atStartOfDay(ZONE).toInstant().minus(rule.windowDays() - 1L, ChronoUnit.DAYS);
    if (attendanceRiskAlertRepository.existsByEmployeeIdAndRuleCodeSince(
        employee.getId(), rule, cooldownSince)) {
      return false;
    }

    long count =
        attendanceRecordRepository.countByUserIdAndStatusAndDateRange(
            employee.getId(), rule.status(), windowStart, windowEnd);
    if (count < rule.threshold()) {
      return false;
    }

    AttendanceRiskAlert alert = new AttendanceRiskAlert();
    alert.setEmployee(employee);
    alert.setRuleCode(rule);
    alert.setRiskLevel(rule.level());
    alert.setWindowStart(windowStart);
    alert.setWindowEnd(windowEnd);
    alert.setMetricCount((int) count);
    alert.setEmployeeNotified(false);
    alert.setManagerNotified(false);
    alert.setEmailSent(false);

    boolean anyEmail = false;

    if (rule.notifyEmployee()) {
      String message = employeeMessage(employee, rule, count, windowStart, windowEnd);
      notificationService.sendAttendanceRisk(systemSender, employee, message, alertPayload(rule, count));
      alert.setEmployeeNotified(true);
      if (mailService.sendAttendanceRiskEmailToEmployee(employee, rule, count, windowStart, windowEnd)) {
        anyEmail = true;
      }
    }

    if (rule.notifyManager()) {
      for (User manager : resolveManagers(employee)) {
        String message = managerMessage(employee, rule, count, windowStart, windowEnd);
        notificationService.sendAttendanceRisk(systemSender, manager, message, alertPayload(rule, count));
        if (mailService.sendAttendanceRiskEmailToManager(
            manager, employee, rule, count, windowStart, windowEnd)) {
          anyEmail = true;
        }
      }
      alert.setManagerNotified(true);
    }

    alert.setEmailSent(anyEmail);
    attendanceRiskAlertRepository.save(alert);
    log.info(
        "Attendance risk alert: employee={} rule={} count={} level={}",
        employee.getEmployeeId(),
        rule.name(),
        count,
        rule.level());
    return true;
  }

  private User resolveSystemSender() {
    return userRepository.findByEmail("superadmin@puncher.com").orElseGet(
        () ->
            userRepository.findAll().stream()
                .filter(
                    u ->
                        u.getRole() == UserRole.SUPER_ADMIN
                            || u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null));
  }

  private List<User> resolveManagers(User employee) {
    Set<User> managers = new LinkedHashSet<>();
    if (employee.getTeam() != null && employee.getTeam().getTeamLeader() != null) {
      User leader = employee.getTeam().getTeamLeader();
      if (!leader.getId().equals(employee.getId())) {
        managers.add(leader);
      }
    }
    if (employee.getDepartment() != null && employee.getDepartment().getAdmin() != null) {
      User deptAdmin = employee.getDepartment().getAdmin();
      if (!deptAdmin.getId().equals(employee.getId())) {
        managers.add(deptAdmin);
      }
    }
    return new ArrayList<>(managers);
  }

  private static String employeeMessage(
      User employee, AttendanceRiskRule rule, long count, LocalDate from, LocalDate to) {
    String name = StringUtils.hasText(employee.getName()) ? employee.getName() : "there";
    return switch (rule.level()) {
      case WARNING ->
          "Hi "
              + name
              + ", you have "
              + statusLabel(rule.status())
              + " "
              + count
              + " time(s) between "
              + from
              + " and "
              + to
              + ". Please review your schedule and punctuality.";
      case MEDIUM ->
          "Hi "
              + name
              + ", lateness is becoming a pattern ("
              + count
              + " late day(s) in the last "
              + rule.windowDays()
              + " days). Let's work on improving arrival times.";
      case HIGH ->
          "Hi "
              + name
              + ", repeated "
              + statusLabel(rule.status()).toLowerCase()
              + " ("
              + count
              + " in "
              + rule.windowDays()
              + " days) has been flagged. Your manager has been notified.";
    };
  }

  private static String managerMessage(
      User employee, AttendanceRiskRule rule, long count, LocalDate from, LocalDate to) {
    String emp =
        StringUtils.hasText(employee.getName())
            ? employee.getName()
            : employee.getEmployeeId();
    return "Attendance alert ("
        + rule.level()
        + "): "
        + emp
        + " — "
        + count
        + " "
        + statusLabel(rule.status()).toLowerCase()
        + " day(s) from "
        + from
        + " to "
        + to
        + " ("
        + rule.label()
        + ").";
  }

  private static String statusLabel(AttendanceStatus status) {
    return status == AttendanceStatus.ABSENT ? "Absent" : "Late";
  }

  private static java.util.Map<String, Object> alertPayload(AttendanceRiskRule rule, long count) {
    return java.util.Map.of(
        "rule", rule.name(),
        "level", rule.level().name(),
        "count", count,
        "label", rule.label());
  }
}
