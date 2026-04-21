package com.punchermanager.service;

import com.punchermanager.domain.ScheduleConfirmation;
import com.punchermanager.domain.ScheduleConfirmationStatus;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.WeeklySchedule;
import com.punchermanager.domain.WeeklyScheduleDay;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.ScheduleConfirmationRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.repository.WeeklyScheduleRepository;
import com.punchermanager.web.dto.WeeklyScheduleDayDto;
import com.punchermanager.web.dto.WeeklyScheduleResponse;
import com.punchermanager.web.dto.WeeklyScheduleUpsertRequest;
import com.punchermanager.web.exception.ApiException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduleService {

  private final WeeklyScheduleRepository weeklyScheduleRepository;
  private final ScheduleConfirmationRepository scheduleConfirmationRepository;
  private final UserRepository userRepository;
  private final NotificationService notificationService;

  public ScheduleService(
      WeeklyScheduleRepository weeklyScheduleRepository,
      ScheduleConfirmationRepository scheduleConfirmationRepository,
      UserRepository userRepository,
      NotificationService notificationService) {
    this.weeklyScheduleRepository = weeklyScheduleRepository;
    this.scheduleConfirmationRepository = scheduleConfirmationRepository;
    this.userRepository = userRepository;
    this.notificationService = notificationService;
  }

  public static LocalDate normalizeWeekStart(LocalDate anyDay) {
    return anyDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
  }

  @Transactional(readOnly = true)
  public WeeklyScheduleResponse getWeek(User actor, UUID employeeUserId, LocalDate weekStart) {
    LocalDate normalized = normalizeWeekStart(weekStart);
    User employee = requireEmployee(employeeUserId);
    assertCanManageEmployeeSchedule(actor, employee);

    WeeklySchedule schedule =
        weeklyScheduleRepository
            .findByEmployeeAndWeekFetched(employeeUserId, normalized)
            .orElse(null);
    if (schedule == null) {
      return new WeeklyScheduleResponse(
          null,
          employeeUserId,
          normalized,
          null,
          null,
          emptyWeekDays(),
          ScheduleConfirmationStatus.PENDING,
          null,
          null);
    }
    ScheduleConfirmation conf =
        scheduleConfirmationRepository
            .findByScheduleAndEmployeeFetched(schedule.getId(), employeeUserId)
            .orElse(null);
    return toResponse(schedule, conf);
  }

  @Transactional
  public WeeklyScheduleResponse upsertWeek(User actor, WeeklyScheduleUpsertRequest req) {
    LocalDate normalized = normalizeWeekStart(req.getWeekStart());
    User employee = requireEmployee(req.getEmployeeId());
    assertCanManageEmployeeSchedule(actor, employee);
    validateDays(req.getDays());

    WeeklySchedule schedule =
        weeklyScheduleRepository
            .findByEmployeeAndWeekFetched(req.getEmployeeId(), normalized)
            .orElse(null);
    if (schedule == null) {
      schedule = new WeeklySchedule();
      schedule.setEmployee(employee);
      schedule.setWeekStart(normalized);
      schedule.setCreatedBy(actor);
    }

    schedule.getDays().clear();
    for (WeeklyScheduleDayDto d : req.getDays()) {
      WeeklyScheduleDay day = new WeeklyScheduleDay();
      day.setSchedule(schedule);
      day.setDayOfWeek(d.dayOfWeek());
      day.setDayOff(d.dayOff());
      day.setStartTime(d.dayOff() ? null : d.startTime());
      day.setEndTime(d.dayOff() ? null : d.endTime());
      schedule.getDays().add(day);
    }

    WeeklySchedule saved = weeklyScheduleRepository.save(schedule);

    ScheduleConfirmation conf =
        scheduleConfirmationRepository
            .findByScheduleAndEmployeeFetched(saved.getId(), employee.getId())
            .orElse(null);
    if (conf == null) {
      conf = new ScheduleConfirmation();
      conf.setSchedule(saved);
      conf.setEmployee(employee);
      conf.setStatus(ScheduleConfirmationStatus.PENDING);
      conf = scheduleConfirmationRepository.save(conf);
    } else {
      conf.setStatus(ScheduleConfirmationStatus.PENDING);
      conf.setComment(null);
      conf.setRespondedAt(null);
      conf = scheduleConfirmationRepository.save(conf);
    }
    return toResponse(saved, conf);
  }

  @Transactional
  public WeeklyScheduleResponse markConfirmationSent(User actor, UUID scheduleId) {
    WeeklySchedule schedule =
        weeklyScheduleRepository
            .findByIdFetched(scheduleId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Schedule not found"));
    User employee = schedule.getEmployee();
    assertCanManageEmployeeSchedule(actor, employee);

    ScheduleConfirmation conf =
        scheduleConfirmationRepository
            .findByScheduleAndEmployeeFetched(scheduleId, employee.getId())
            .orElse(null);
    if (conf == null) {
      conf = new ScheduleConfirmation();
      conf.setSchedule(schedule);
      conf.setEmployee(employee);
    }
    conf.setStatus(ScheduleConfirmationStatus.PENDING);
    conf.setComment(null);
    conf.setRespondedAt(null);
    conf = scheduleConfirmationRepository.save(conf);
    notificationService.sendScheduleConfirm(actor, employee, toResponse(schedule, conf));
    return toResponse(schedule, conf);
  }

  @Transactional
  public WeeklyScheduleResponse respond(User employeeActor, UUID scheduleId, ScheduleConfirmationStatus status, String comment) {
    if (employeeActor.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only employees can respond to schedules");
    }
    if (status == ScheduleConfirmationStatus.PENDING) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid response status");
    }
    ScheduleConfirmation conf =
        scheduleConfirmationRepository
            .findByScheduleAndEmployeeFetched(scheduleId, employeeActor.getId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Confirmation not found"));
    conf.setStatus(status);
    conf.setComment(comment != null && !comment.isBlank() ? comment.trim() : null);
    conf.setRespondedAt(Instant.now());
    ScheduleConfirmation saved = scheduleConfirmationRepository.save(conf);
    WeeklySchedule schedule = saved.getSchedule();
    String msg =
        status == ScheduleConfirmationStatus.CONFIRMED
            ? "Schedule confirmed."
            : "Employee requested a correction to the schedule.";
    notificationService.sendScheduleResponse(employeeActor, schedule.getCreatedBy(), msg, toResponse(schedule, saved));
    return toResponse(schedule, saved);
  }

  private User requireEmployee(UUID employeeUserId) {
    User u =
        userRepository
            .findByIdWithContext(employeeUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (u.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Target user must have EMPLOYEE role");
    }
    if (u.getTeam() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Employee must belong to a team");
    }
    return u;
  }

  private void assertCanManageEmployeeSchedule(User actor, User employee) {
    switch (actor.getRole()) {
      case SUPER_ADMIN -> {}
      case ADMIN -> {
        if (employee.getRole() == UserRole.SUPER_ADMIN) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Cannot manage super admin");
        }
      }
      case DEPT_MANAGER -> {
        if (actor.getDepartment() == null
            || employee.getDepartment() == null
            || !actor.getDepartment().getId().equals(employee.getDepartment().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Outside your department");
        }
      }
      case TEAM_LEADER -> {
        if (actor.getTeam() == null
            || employee.getTeam() == null
            || !actor.getTeam().getId().equals(employee.getTeam().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Outside your team");
        }
      }
      case EMPLOYEE -> {
        if (!actor.getId().equals(employee.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Cannot view another employee's schedule");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
  }

  private void validateDays(List<WeeklyScheduleDayDto> days) {
    if (days == null || days.size() != 7) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Exactly 7 days are required");
    }
    days.stream()
        .map(WeeklyScheduleDayDto::dayOfWeek)
        .distinct()
        .sorted()
        .forEach(
            d -> {
              if (d < 0 || d > 6) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid dayOfWeek: " + d);
              }
            });
    for (WeeklyScheduleDayDto d : days) {
      if (!d.dayOff()) {
        if (d.startTime() == null || d.endTime() == null) {
          throw new ApiException(
              HttpStatus.BAD_REQUEST, "Start and end time are required when not day off");
        }
        if (!d.startTime().isBefore(d.endTime())) {
          throw new ApiException(HttpStatus.BAD_REQUEST, "Start time must be before end time");
        }
      }
    }
  }

  private List<WeeklyScheduleDayDto> emptyWeekDays() {
    return List.of(
        new WeeklyScheduleDayDto(0, true, null, null),
        new WeeklyScheduleDayDto(1, false, LocalTime.of(9, 0), LocalTime.of(17, 0)),
        new WeeklyScheduleDayDto(2, false, LocalTime.of(9, 0), LocalTime.of(17, 0)),
        new WeeklyScheduleDayDto(3, false, LocalTime.of(9, 0), LocalTime.of(17, 0)),
        new WeeklyScheduleDayDto(4, false, LocalTime.of(9, 0), LocalTime.of(17, 0)),
        new WeeklyScheduleDayDto(5, false, LocalTime.of(9, 0), LocalTime.of(17, 0)),
        new WeeklyScheduleDayDto(6, true, null, null));
  }

  private WeeklyScheduleResponse toResponse(WeeklySchedule s, ScheduleConfirmation conf) {
    List<WeeklyScheduleDayDto> days =
        s.getDays().stream()
            .sorted(Comparator.comparingInt(WeeklyScheduleDay::getDayOfWeek))
            .map(
                d ->
                    new WeeklyScheduleDayDto(
                        d.getDayOfWeek(), d.isDayOff(), d.getStartTime(), d.getEndTime()))
            .toList();
    ScheduleConfirmationStatus st =
        conf != null ? conf.getStatus() : ScheduleConfirmationStatus.PENDING;
    String comment = conf != null ? conf.getComment() : null;
    Instant respondedAt = conf != null ? conf.getRespondedAt() : null;
    return new WeeklyScheduleResponse(
        s.getId(),
        s.getEmployee().getId(),
        s.getWeekStart(),
        s.getCreatedBy().getId(),
        s.getUpdatedAt(),
        days,
        st,
        comment,
        respondedAt);
  }
}

