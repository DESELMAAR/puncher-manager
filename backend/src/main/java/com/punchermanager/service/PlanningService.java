package com.punchermanager.service;

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

  /** Mock planning: working Mon–Fri with fixed hours; weekends off. */
  public Optional<PlanningResponseDto> getPlannedDay(String employeeId, LocalDate date) {
    DayOfWeek dow = date.getDayOfWeek();
    if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
      return Optional.empty();
    }
    return Optional.of(
        new PlanningResponseDto(
            employeeId, date, DEFAULT_START, DEFAULT_END, true));
  }
}
