package com.punchermanager.service;

import com.punchermanager.domain.User;
import com.punchermanager.web.dto.WeeklyScheduleResponse;
import java.time.format.DateTimeFormatter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MailService {

  private static final Logger log = LoggerFactory.getLogger(MailService.class);
  private static final DateTimeFormatter WEEK_FMT = DateTimeFormatter.ofPattern("MMMM d, yyyy");

  private final JavaMailSender mailSenderOrNull;
  private final String mailHost;
  private final String publicUrl;
  private final String fromOverride;
  private final String springUsername;

  public MailService(
      @Autowired(required = false) JavaMailSender mailSenderOrNull,
      @Value("${spring.mail.host:}") String mailHost,
      @Value("${app.public-url:http://localhost:3000}") String publicUrl,
      @Value("${app.mail.from:}") String fromOverride,
      @Value("${spring.mail.username:}") String springUsername) {
    this.mailSenderOrNull = mailSenderOrNull;
    this.mailHost = mailHost;
    this.publicUrl = trimTrailingSlash(publicUrl);
    this.fromOverride = fromOverride;
    this.springUsername = springUsername;
  }

  /** Sends schedule email; never throws. Skips when SMTP is not configured or send fails. */
  public void sendScheduleEmail(
      User manager, User employee, WeeklyScheduleResponse schedule, boolean reminder) {
    if (!isMailConfigured()) {
      log.debug("Mail not configured (spring.mail.host); skipping schedule email");
      return;
    }
    String to = employee.getEmail();
    if (!StringUtils.hasText(to)) {
      log.warn("Employee {} has no email; skipping schedule mail", employee.getId());
      return;
    }
    String from = resolveFromAddress();
    if (!StringUtils.hasText(from)) {
      log.warn("Set app.mail.from or spring.mail.username to send mail; skipping schedule email");
      return;
    }
    try {
      SimpleMailMessage msg = new SimpleMailMessage();
      msg.setFrom(from);
      msg.setTo(to);
      msg.setSubject(
          reminder
              ? "Reminder: please confirm your weekly schedule"
              : "Your weekly schedule is ready — please confirm");
      msg.setText(buildBody(manager, employee, schedule));
      mailSenderOrNull.send(msg);
    } catch (Exception e) {
      log.warn("Failed to send schedule email to {}: {}", to, e.getMessage());
    }
  }

  /** Employee attendance risk email; returns true if sent. */
  public boolean sendAttendanceRiskEmailToEmployee(
      User employee,
      com.punchermanager.domain.AttendanceRiskRule rule,
      long count,
      java.time.LocalDate from,
      java.time.LocalDate to) {
    if (!isMailConfigured() || !StringUtils.hasText(employee.getEmail())) {
      return false;
    }
    String fromAddr = resolveFromAddress();
    if (!StringUtils.hasText(fromAddr)) {
      return false;
    }
    try {
      SimpleMailMessage msg = new SimpleMailMessage();
      msg.setFrom(fromAddr);
      msg.setTo(employee.getEmail().trim());
      msg.setSubject(employeeSubject(rule));
      msg.setText(employeeBody(employee, rule, count, from, to));
      mailSenderOrNull.send(msg);
      return true;
    } catch (Exception e) {
      log.warn("Failed to send attendance risk email to {}: {}", employee.getEmail(), e.getMessage());
      return false;
    }
  }

  /** Manager attendance risk email; returns true if sent. */
  public boolean sendAttendanceRiskEmailToManager(
      User manager,
      User employee,
      com.punchermanager.domain.AttendanceRiskRule rule,
      long count,
      java.time.LocalDate from,
      java.time.LocalDate to) {
    if (!isMailConfigured() || !StringUtils.hasText(manager.getEmail())) {
      return false;
    }
    String fromAddr = resolveFromAddress();
    if (!StringUtils.hasText(fromAddr)) {
      return false;
    }
    try {
      SimpleMailMessage msg = new SimpleMailMessage();
      msg.setFrom(fromAddr);
      msg.setTo(manager.getEmail().trim());
      msg.setSubject("Attendance alert: " + employee.getName());
      msg.setText(managerBody(manager, employee, rule, count, from, to));
      mailSenderOrNull.send(msg);
      return true;
    } catch (Exception e) {
      log.warn(
          "Failed to send attendance risk email to manager {}: {}",
          manager.getEmail(),
          e.getMessage());
      return false;
    }
  }

  private static String employeeSubject(com.punchermanager.domain.AttendanceRiskRule rule) {
    return switch (rule.level()) {
      case WARNING -> "Friendly reminder: attendance notice";
      case MEDIUM -> "Coaching notice: repeated lateness";
      case HIGH -> "Important: attendance escalation";
    };
  }

  private String employeeBody(
      User employee,
      com.punchermanager.domain.AttendanceRiskRule rule,
      long count,
      java.time.LocalDate from,
      java.time.LocalDate to) {
    String name = StringUtils.hasText(employee.getName()) ? employee.getName() : "there";
    String status = rule.status().name().toLowerCase();
    return "Hello "
        + name
        + ",\n\n"
        + rule.label()
        + ".\n\n"
        + "Our records show "
        + count
        + " "
        + status
        + " day(s) between "
        + from
        + " and "
        + to
        + ".\n\n"
        + switch (rule.level()) {
          case WARNING ->
              "Please review your schedule and aim to arrive on time for upcoming shifts.";
          case MEDIUM ->
              "Lateness is becoming a pattern. Please plan ahead so you can start on time.";
          case HIGH ->
              "This level of attendance concern has been escalated. Your manager has been notified.";
        }
        + "\n\nSign in to review your attendance:\n"
        + publicUrl
        + "/team\n\n"
        + "Thank you,\n"
        + "Puncher Manager";
  }

  private static String managerBody(
      User manager,
      User employee,
      com.punchermanager.domain.AttendanceRiskRule rule,
      long count,
      java.time.LocalDate from,
      java.time.LocalDate to) {
    String mgr = StringUtils.hasText(manager.getName()) ? manager.getName() : "Manager";
    String emp = StringUtils.hasText(employee.getName()) ? employee.getName() : employee.getEmployeeId();
    return "Hello "
        + mgr
        + ",\n\n"
        + "Attendance alert ("
        + rule.level()
        + ") for "
        + emp
        + " ("
        + employee.getEmployeeId()
        + ").\n\n"
        + "Rule: "
        + rule.label()
        + "\n"
        + "Count: "
        + count
        + " "
        + rule.status().name().toLowerCase()
        + " day(s)\n"
        + "Period: "
        + from
        + " to "
        + to
        + "\n\n"
        + "Please follow up with the employee as needed.\n\n"
        + "Puncher Manager";
  }

  private boolean isMailConfigured() {
    return mailSenderOrNull != null && StringUtils.hasText(mailHost);
  }

  private String resolveFromAddress() {
    if (StringUtils.hasText(fromOverride)) {
      return fromOverride.trim();
    }
    return StringUtils.hasText(springUsername) ? springUsername.trim() : null;
  }

  private static String trimTrailingSlash(String url) {
    if (url == null || url.isEmpty()) {
      return "http://localhost:3000";
    }
    return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
  }

  private String buildBody(User manager, User employee, WeeklyScheduleResponse schedule) {
    String weekLabel = schedule.weekStart() != null ? schedule.weekStart().format(WEEK_FMT) : "the selected week";
    String managerName = manager != null && StringUtils.hasText(manager.getName()) ? manager.getName() : "your manager";
    String employeeName =
        StringUtils.hasText(employee.getName()) ? employee.getName() : "there";
    String link = publicUrl + "/dashboard";
    return "Hello " + employeeName + ",\n\n"
        + "Your weekly schedule for the week starting " + weekLabel + " has been updated by "
        + managerName + ".\n\n"
        + "Please sign in to review and confirm your schedule:\n"
        + link
        + "\n\n"
        + "Thank you,\n"
        + "Puncher Manager";
  }
}
