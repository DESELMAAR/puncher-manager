package com.punchermanager.service;

import com.punchermanager.domain.User;
import com.punchermanager.domain.WeeklySchedule;
import com.punchermanager.domain.WeeklyScheduleDay;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.repository.WeeklyScheduleRepository;
import com.punchermanager.web.dto.PlanningResponseDto;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class PlanningService {

  private static final LocalTime DEFAULT_START = LocalTime.of(9, 0);
  private static final LocalTime DEFAULT_END = LocalTime.of(17, 0);

  private final UserRepository userRepository;
  private final WeeklyScheduleRepository weeklyScheduleRepository;

  public PlanningService(UserRepository userRepository, WeeklyScheduleRepository weeklyScheduleRepository) {
    this.userRepository = userRepository;
    this.weeklyScheduleRepository = weeklyScheduleRepository;
  }

  /** Mock planning: working Mon–Fri with fixed hours; weekends off. */
  public Optional<PlanningResponseDto> getPlannedDay(String employeeId, LocalDate date) {
    User user = userRepository.findByEmployeeId(employeeId).orElse(null);
    if (user != null) {
      LocalDate weekStart = ScheduleService.normalizeWeekStart(date);
      WeeklySchedule schedule =
          weeklyScheduleRepository.findByEmployeeAndWeekFetched(user.getId(), weekStart).orElse(null);
      if (schedule != null) {
        int dow = mapToScheduleDayOfWeek(date.getDayOfWeek());
        WeeklyScheduleDay day =
            schedule.getDays().stream().filter(d -> d.getDayOfWeek() == dow).findFirst().orElse(null);
        if (day != null) {
          if (day.isDayOff()) {
            return Optional.empty();
          }
          if (day.getStartTime() != null && day.getEndTime() != null) {
            return Optional.of(
                new PlanningResponseDto(employeeId, date, day.getStartTime(), day.getEndTime(), true));
          }
        }
      }
    }

    DayOfWeek dow = date.getDayOfWeek();
    if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
      return Optional.empty();
    }
    return Optional.of(
        new PlanningResponseDto(
            employeeId, date, DEFAULT_START, DEFAULT_END, true));
  }

  private int mapToScheduleDayOfWeek(DayOfWeek dow) {
    if (dow == DayOfWeek.SUNDAY) return 0;
    return dow.getValue(); // MON=1 .. SAT=6
  }
}
