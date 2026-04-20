package com.punchermanager.service;

import com.punchermanager.domain.AttendanceRecord;
import com.punchermanager.domain.AttendanceStatus;
import com.punchermanager.domain.Punch;
import com.punchermanager.domain.PunchType;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.AttendanceRecordRepository;
import com.punchermanager.repository.PunchRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.AttendanceRowDto;
import com.punchermanager.web.dto.PlanningResponseDto;
import com.punchermanager.web.dto.PunchResponse;
import com.punchermanager.web.exception.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttendanceService {

  private static final ZoneId ZONE = ZoneId.systemDefault();
  private static final int LATE_GRACE_MINUTES = 10;

  private final AttendanceRecordRepository attendanceRecordRepository;
  private final PlanningService planningService;
  private final PunchRepository punchRepository;
  private final UserRepository userRepository;
  private final TeamRepository teamRepository;

  public AttendanceService(
      AttendanceRecordRepository attendanceRecordRepository,
      PlanningService planningService,
      PunchRepository punchRepository,
      UserRepository userRepository,
      TeamRepository teamRepository) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.planningService = planningService;
    this.punchRepository = punchRepository;
    this.userRepository = userRepository;
    this.teamRepository = teamRepository;
  }

  @Transactional
  public void evaluateAfterLogout(User employee, LocalDate day) {
    PlanningResponseDto plan =
        planningService.getPlannedDay(employee.getEmployeeId(), day).orElse(null);
    if (plan == null) {
      return;
    }
    Instant start = day.atStartOfDay(ZONE).toInstant();
    Instant end = day.plusDays(1).atStartOfDay(ZONE).toInstant();
    Punch workStart =
        punchRepository
            .findFirstByUserIdAndPunchTypeAndPunchedAtBetween(
                employee.getId(), PunchType.WORK_START, start, end)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.BAD_REQUEST, "No work start found for attendance evaluation"));

    LocalTime actualStart = LocalTime.ofInstant(workStart.getPunchedAt(), ZONE);
    LocalTime expected = plan.expectedStartTime();

    Instant expectedInstant = expected.atDate(day).atZone(ZONE).toInstant();
    long diffMinutes = Duration.between(expectedInstant, workStart.getPunchedAt()).toMinutes();

    AttendanceStatus status =
        diffMinutes <= LATE_GRACE_MINUTES ? AttendanceStatus.ON_TIME : AttendanceStatus.LATE;
    Integer minutesLate =
        status == AttendanceStatus.LATE ? (int) Math.max(0, diffMinutes) : 0;

    upsertRecord(employee, day, status, expected, actualStart, minutesLate);
  }

  @Transactional
  public void markAbsentIfNeeded(User employee, LocalDate day) {
    if (employee.getRole() != UserRole.EMPLOYEE) {
      return;
    }
    if (employee.getStatus() != UserStatus.ACTIVE) {
      return;
    }
    if (planningService.getPlannedDay(employee.getEmployeeId(), day).isEmpty()) {
      return;
    }
    if (attendanceRecordRepository.findByUserIdAndRecordDate(employee.getId(), day).isPresent()) {
      return;
    }
    Instant start = day.atStartOfDay(ZONE).toInstant();
    Instant end = day.plusDays(1).atStartOfDay(ZONE).toInstant();
    if (!punchRepository.findByUserAndRange(employee.getId(), start, end).isEmpty()) {
      return;
    }
    upsertRecord(employee, day, AttendanceStatus.ABSENT, null, null, null);
  }

  private void upsertRecord(
      User employee,
      LocalDate day,
      AttendanceStatus status,
      LocalTime expectedStart,
      LocalTime actualStart,
      Integer minutesLate) {
    AttendanceRecord record =
        attendanceRecordRepository
            .findByUserIdAndRecordDate(employee.getId(), day)
            .orElseGet(
                () -> {
                  AttendanceRecord r = new AttendanceRecord();
                  r.setUser(employee);
                  r.setEmployeeId(employee.getEmployeeId());
                  r.setRecordDate(day);
                  return r;
                });
    record.setStatus(status);
    record.setExpectedStart(expectedStart);
    record.setActualStart(actualStart);
    record.setMinutesLate(minutesLate);
    attendanceRecordRepository.save(record);
  }

  @Transactional(readOnly = true)
  public List<AttendanceRowDto> teamAttendance(UUID teamId, LocalDate date, User requester) {
    Team team =
        teamRepository
            .findByIdFetched(teamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    assertCanViewTeam(requester, team);

    List<User> members = userRepository.findEmployeesByTeamId(teamId);
    List<UUID> ids = members.stream().map(User::getId).toList();
    List<AttendanceRowDto> rows = new ArrayList<>();
    Instant start = date.atStartOfDay(ZONE).toInstant();
    Instant end = date.plusDays(1).atStartOfDay(ZONE).toInstant();
    List<Punch> punches =
        ids.isEmpty() ? List.of() : punchRepository.findByUsersAndRange(ids, start, end);
    for (User u : members) {
      var att = attendanceRecordRepository.findByUserIdAndRecordDate(u.getId(), date).orElse(null);
      List<PunchResponse> punchDtos =
          punches.stream()
              .filter(p -> p.getUser().getId().equals(u.getId()))
              .map(p -> new PunchResponse(p.getId(), p.getPunchType(), p.getPunchedAt()))
              .toList();
      rows.add(
          new AttendanceRowDto(
              u.getId(),
              u.getName(),
              u.getEmployeeId(),
              date,
              att != null ? att.getStatus() : null,
              att != null ? att.getExpectedStart() : null,
              att != null ? att.getActualStart() : null,
              att != null ? att.getMinutesLate() : null,
              punchDtos));
    }
    return rows;
  }

  private void assertCanViewTeam(User requester, Team team) {
    switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case TEAM_LEADER -> {
        if (!team.getTeamLeader().getId().equals(requester.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not your team");
        }
      }
      case DEPT_MANAGER -> {
        if (requester.getDepartment() == null
            || !team.getDepartment().getId().equals(requester.getDepartment().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Team not in your department");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
  }
}
