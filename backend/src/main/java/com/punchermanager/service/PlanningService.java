package com.punchermanager.service;

import com.punchermanager.domain.ScheduleConfirmation;
import com.punchermanager.domain.ScheduleConfirmationStatus;
import com.punchermanager.domain.User;
import com.punchermanager.domain.WeeklySchedule;
import com.punchermanager.domain.WeeklyScheduleDay;
import com.punchermanager.repository.ScheduleConfirmationRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.PlanningResponseDto;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class PlanningService {

  private final UserRepository userRepository;
  private final ScheduleConfirmationRepository scheduleConfirmationRepository;

  public PlanningService(
      UserRepository userRepository, ScheduleConfirmationRepository scheduleConfirmationRepository) {
    this.userRepository = userRepository;
    this.scheduleConfirmationRepository = scheduleConfirmationRepository;
  }

  /**
   * Planned shift for a calendar day, only when the employee has a <strong>confirmed</strong>
   * weekly schedule for that week. There is no default/mock plan: absent confirmation, returns
   * empty.
   */
  public Optional<PlanningResponseDto> getPlannedDay(String employeeId, LocalDate date) {
    User user = userRepository.findByEmployeeId(employeeId).orElse(null);
    if (user == null) {
      return Optional.empty();
    }
    LocalDate weekStart = ScheduleService.normalizeWeekStart(date);
    Optional<ScheduleConfirmation> confirmed =
        scheduleConfirmationRepository.findByEmployeeWeekAndStatus(
            user.getId(), weekStart, ScheduleConfirmationStatus.CONFIRMED);
    if (confirmed.isEmpty()) {
      return Optional.empty();
    }
    WeeklySchedule schedule = confirmed.get().getSchedule();
    int dow = mapToScheduleDayOfWeek(date.getDayOfWeek());
    WeeklyScheduleDay day =
        schedule.getDays().stream().filter(d -> d.getDayOfWeek() == dow).findFirst().orElse(null);
    if (day == null) {
      return Optional.empty();
    }
    if (day.isDayOff()) {
      return Optional.empty();
    }
    if (day.getStartTime() != null && day.getEndTime() != null) {
      return Optional.of(
          new PlanningResponseDto(employeeId, date, day.getStartTime(), day.getEndTime(), true));
    }
    return Optional.empty();
  }

  /** Whether this calendar day falls in a week where the employee has a confirmed schedule. */
  public boolean hasConfirmedScheduleForWeek(String employeeId, LocalDate date) {
    User user = userRepository.findByEmployeeId(employeeId).orElse(null);
    if (user == null) {
      return false;
    }
    LocalDate weekStart = ScheduleService.normalizeWeekStart(date);
    return scheduleConfirmationRepository
        .findByEmployeeWeekAndStatus(user.getId(), weekStart, ScheduleConfirmationStatus.CONFIRMED)
        .isPresent();
  }

  private int mapToScheduleDayOfWeek(DayOfWeek dow) {
    if (dow == DayOfWeek.SUNDAY) return 0;
    return dow.getValue(); // MON=1 .. SAT=6
  }
}
