package com.punchermanager.schedule;

import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.service.AttendanceService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AbsenceEvaluationScheduler {

  private static final Logger log = LoggerFactory.getLogger(AbsenceEvaluationScheduler.class);
  private static final ZoneId ZONE = ZoneId.systemDefault();

  private final UserRepository userRepository;
  private final AttendanceService attendanceService;

  public AbsenceEvaluationScheduler(
      UserRepository userRepository, AttendanceService attendanceService) {
    this.userRepository = userRepository;
    this.attendanceService = attendanceService;
  }

  @Scheduled(cron = "0 0 2 * * *")
  @Transactional
  public void evaluatePreviousDayAbsences() {
    LocalDate yesterday = LocalDate.now(ZONE).minusDays(1);
    log.info("Absence evaluation for {}", yesterday);
    List<User> employees =
        userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE);
    for (User u : employees) {
      attendanceService.markAbsentIfNeeded(u, yesterday);
    }
  }
}
