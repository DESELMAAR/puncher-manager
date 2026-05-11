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
