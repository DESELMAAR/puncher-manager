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
import com.punchermanager.web.dto.AttendanceOverviewGroupDto;
import com.punchermanager.web.dto.AttendanceRowDto;
import com.punchermanager.web.dto.PlanningResponseDto;
import com.punchermanager.web.dto.PunchResponse;
import com.punchermanager.web.exception.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttendanceService {

  private static final ZoneId ZONE = ZoneId.systemDefault();
  private static final DateTimeFormatter SCHEDULE_TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
  private static final int LATE_GRACE_MINUTES = 10;
  /** Minutes before scheduled end considered too early for logout. */
  private static final int END_EARLY_TOLERANCE_MINUTES = 30;
  /** Minutes after scheduled end allowed before flagging late end. */
  private static final int END_LATE_TOLERANCE_MINUTES = 60;

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
    Instant latestAllowedStart = expectedInstant.plus(LATE_GRACE_MINUTES, ChronoUnit.MINUTES);
    boolean late = workStart.getPunchedAt().isAfter(latestAllowedStart);

    AttendanceStatus status = late ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
    Integer minutesLate =
        late
            ? (int)
                Math.max(
                    0L,
                    ChronoUnit.MINUTES.between(expectedInstant, workStart.getPunchedAt()))
            : 0;

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
  public List<AttendanceRowDto> teamAttendance(
      UUID teamId, LocalDate date, User requester, ZoneId zone) {
    Team team =
        teamRepository
            .findByIdFetched(teamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    assertCanViewTeam(requester, team);

    List<User> members = userRepository.findEmployeesByTeamId(teamId);
    List<UUID> ids = members.stream().map(User::getId).toList();
    List<AttendanceRowDto> rows = new ArrayList<>();
    Instant start = date.atStartOfDay(zone).toInstant();
    Instant end = date.plusDays(1).atStartOfDay(zone).toInstant();
    List<Punch> punches =
        ids.isEmpty() ? List.of() : punchRepository.findByUsersAndRange(ids, start, end);
    boolean scheduleVsPlanCheck =
        requester.getRole() == UserRole.SUPER_ADMIN
            || requester.getRole() == UserRole.ADMIN
            || requester.getRole() == UserRole.DEPT_MANAGER
            || requester.getRole() == UserRole.TEAM_LEADER;

    for (User u : members) {
      var att = attendanceRecordRepository.findByUserIdAndRecordDate(u.getId(), date).orElse(null);
      List<PunchResponse> punchDtos =
          punches.stream()
              .filter(p -> p.getUser().getId().equals(u.getId()))
              .map(p -> new PunchResponse(p.getId(), p.getPunchType(), p.getPunchedAt()))
              .sorted(Comparator.comparing(PunchResponse::punchedAt))
              .toList();

      Boolean scheduleOk = null;
      String scheduleNote = null;
      if (scheduleVsPlanCheck) {
        ScheduleVsPlanResult check =
            verifyScheduleVsPunches(u.getEmployeeId(), date, punchDtos, zone);
        scheduleOk = check.ok();
        scheduleNote = check.note();
      }

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
              punchDtos,
              scheduleOk,
              scheduleNote));
    }
    return rows;
  }

  @Transactional(readOnly = true)
  public List<AttendanceRowDto> teamAttendanceRange(
      UUID teamId, LocalDate from, LocalDate to, User requester, ZoneId zone) {
    if (from.isAfter(to)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid date range");
    }
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    if (days > 62) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Range too large (max 62 days)");
    }

    Team team =
        teamRepository
            .findByIdFetched(teamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    assertCanViewTeam(requester, team);

    List<User> members = userRepository.findEmployeesByTeamId(teamId);
    List<UUID> userIds = members.stream().map(User::getId).toList();
    if (userIds.isEmpty()) {
      return List.of();
    }

    Instant start = from.atStartOfDay(zone).toInstant();
    Instant endExclusive = to.plusDays(1).atStartOfDay(zone).toInstant();
    List<Punch> punches = punchRepository.findByUsersAndRange(userIds, start, endExclusive);
    List<com.punchermanager.domain.AttendanceRecord> recs =
        attendanceRecordRepository.findByUserIdsAndDateRange(userIds, from, to);

    // Index records by (userId, date)
    Map<String, com.punchermanager.domain.AttendanceRecord> recByKey = new LinkedHashMap<>();
    for (var r : recs) {
      recByKey.put(r.getUser().getId() + "|" + r.getRecordDate(), r);
    }

    // Index punches by (userId, localDate)
    Map<String, List<PunchResponse>> punchesByKey = new LinkedHashMap<>();
    for (Punch p : punches) {
      LocalDate d = LocalDate.ofInstant(p.getPunchedAt(), zone);
      if (d.isBefore(from) || d.isAfter(to)) continue;
      String key = p.getUser().getId() + "|" + d;
      punchesByKey
          .computeIfAbsent(key, k -> new ArrayList<>())
          .add(new PunchResponse(p.getId(), p.getPunchType(), p.getPunchedAt()));
    }
    for (List<PunchResponse> list : punchesByKey.values()) {
      list.sort(Comparator.comparing(PunchResponse::punchedAt));
    }

    boolean scheduleVsPlanCheck =
        requester.getRole() == UserRole.SUPER_ADMIN
            || requester.getRole() == UserRole.ADMIN
            || requester.getRole() == UserRole.DEPT_MANAGER
            || requester.getRole() == UserRole.TEAM_LEADER;

    List<AttendanceRowDto> out = new ArrayList<>();
    for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
      for (User u : members) {
        String key = u.getId() + "|" + day;
        var att = recByKey.get(key);
        List<PunchResponse> punchDtos = punchesByKey.getOrDefault(key, List.of());

        Boolean scheduleOk = null;
        String scheduleNote = null;
        if (scheduleVsPlanCheck) {
          ScheduleVsPlanResult check =
              verifyScheduleVsPunches(u.getEmployeeId(), day, punchDtos, zone);
          scheduleOk = check.ok();
          scheduleNote = check.note();
        }

        out.add(
            new AttendanceRowDto(
                u.getId(),
                u.getName(),
                u.getEmployeeId(),
                day,
                att != null ? att.getStatus() : null,
                att != null ? att.getExpectedStart() : null,
                att != null ? att.getActualStart() : null,
                att != null ? att.getMinutesLate() : null,
                punchDtos,
                scheduleOk,
                scheduleNote));
      }
    }
    return out;
  }

  @Transactional(readOnly = true)
  public List<AttendanceOverviewGroupDto> overview(LocalDate date, User requester, ZoneId zone) {
    List<Team> teamsInScope = resolveTeamsInScope(requester);
    Map<UUID, Team> byId = new LinkedHashMap<>();
    for (Team t : teamsInScope) {
      byId.put(t.getId(), t);
    }

    List<AttendanceOverviewGroupDto> out = new ArrayList<>();
    for (Team t : byId.values()) {
      List<AttendanceRowDto> rows = teamAttendance(t.getId(), date, requester, zone);
      out.add(
          new AttendanceOverviewGroupDto(
              t.getDepartment().getId(), t.getDepartment().getName(), t.getId(), t.getName(), rows));
    }
    return out;
  }

  @Transactional(readOnly = true)
  public List<AttendanceOverviewGroupDto> overviewRange(
      LocalDate from, LocalDate to, User requester, ZoneId zone) {
    List<Team> teamsInScope = resolveTeamsInScope(requester);
    Map<UUID, Team> byId = new LinkedHashMap<>();
    for (Team t : teamsInScope) {
      byId.put(t.getId(), t);
    }

    List<AttendanceOverviewGroupDto> out = new ArrayList<>();
    for (Team t : byId.values()) {
      List<AttendanceRowDto> rows = teamAttendanceRange(t.getId(), from, to, requester, zone);
      out.add(
          new AttendanceOverviewGroupDto(
              t.getDepartment().getId(), t.getDepartment().getName(), t.getId(), t.getName(), rows));
    }
    return out;
  }

  private List<Team> resolveTeamsInScope(User requester) {
    return switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> teamRepository.findAll().stream()
          .map(t -> teamRepository.findByIdFetched(t.getId()).orElse(t))
          .toList();
      case DEPT_MANAGER -> {
        if (requester.getDepartment() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No department assigned");
        }
        UUID deptId = requester.getDepartment().getId();
        yield teamRepository.findByDepartmentId(deptId).stream()
            .map(t -> teamRepository.findByIdFetched(t.getId()).orElse(t))
            .toList();
      }
      case TEAM_LEADER -> {
        if (requester.getTeam() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No team assigned");
        }
        Team t =
            teamRepository
                .findByIdFetched(requester.getTeam().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
        yield List.of(t);
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    };
  }

  private record ScheduleVsPlanResult(boolean ok, String note) {}

  /**
   * Compares {@link PlanningService} day plan (weekly schedule or mock) to first {@link
   * PunchType#WORK_START} and last {@link PunchType#LOGOUT} for the calendar day.
   */
  private ScheduleVsPlanResult verifyScheduleVsPunches(
      String employeeId, LocalDate date, List<PunchResponse> sortedPunches, ZoneId zone) {

    var planOpt = planningService.getPlannedDay(employeeId, date);

    PunchResponse firstWorkStart =
        sortedPunches.stream().filter(p -> p.type() == PunchType.WORK_START).findFirst().orElse(null);
    PunchResponse lastLogout = null;
    for (int i = sortedPunches.size() - 1; i >= 0; i--) {
      PunchResponse p = sortedPunches.get(i);
      if (p.type() == PunchType.LOGOUT) {
        lastLogout = p;
        break;
      }
    }

    if (planOpt.isEmpty()) {
      if (firstWorkStart != null) {
        return new ScheduleVsPlanResult(
            false,
            "Punched on scheduled day off (WORK_START "
                + fmtInstantLocal(firstWorkStart.punchedAt(), zone)
                + ")");
      }
      return new ScheduleVsPlanResult(true, "OK (day off)");
    }

    PlanningResponseDto plan = planOpt.get();
    LocalTime expectedStart = plan.expectedStartTime();
    LocalTime expectedEnd = plan.expectedEndTime();
    String shiftWindow = fmtTime(expectedStart) + "–" + fmtTime(expectedEnd);

    if (firstWorkStart == null) {
      return new ScheduleVsPlanResult(
          false, "Missing WORK_START (scheduled shift " + shiftWindow + ")");
    }

    // Late only if punch is after scheduled start + grace; early / on-time / within grace are OK.
    Instant scheduledStart = expectedStart.atDate(date).atZone(zone).toInstant();
    Instant latestAllowedStart = scheduledStart.plus(LATE_GRACE_MINUTES, ChronoUnit.MINUTES);
    if (firstWorkStart.punchedAt().isAfter(latestAllowedStart)) {
      return new ScheduleVsPlanResult(
          false,
          "Late start: WORK_START "
              + fmtInstantLocal(firstWorkStart.punchedAt(), zone)
              + " vs scheduled "
              + fmtTime(expectedStart)
              + " (+"
              + LATE_GRACE_MINUTES
              + " min grace)");
    }

    if (lastLogout == null) {
      // Never flag missing end-shift until the employee logs out.
      return new ScheduleVsPlanResult(
          true,
          "No LOGOUT yet (scheduled shift " + shiftWindow + ", end " + fmtTime(expectedEnd) + ")");
    }

    long minutesEarlyVsEnd =
        Duration.between(lastLogout.punchedAt(), expectedEnd.atDate(date).atZone(zone).toInstant())
            .toMinutes();
    if (minutesEarlyVsEnd > END_EARLY_TOLERANCE_MINUTES) {
      return new ScheduleVsPlanResult(
          false,
          "Ended shift early: LOGOUT "
              + fmtInstantLocal(lastLogout.punchedAt(), zone)
              + " vs scheduled end "
              + fmtTime(expectedEnd));
    }

    long minutesLateVsEnd =
        Duration.between(expectedEnd.atDate(date).atZone(zone).toInstant(), lastLogout.punchedAt())
            .toMinutes();
    if (minutesLateVsEnd > END_LATE_TOLERANCE_MINUTES) {
      return new ScheduleVsPlanResult(
          false,
          "Ended shift late: LOGOUT "
              + fmtInstantLocal(lastLogout.punchedAt(), zone)
              + " vs scheduled end "
              + fmtTime(expectedEnd));
    }

    return new ScheduleVsPlanResult(true, "OK (scheduled " + shiftWindow + ")");
  }

  private static String fmtTime(LocalTime t) {
    return t.format(SCHEDULE_TIME_FMT);
  }

  private static String fmtInstantLocal(Instant instant, ZoneId zone) {
    return LocalTime.ofInstant(instant, zone).format(SCHEDULE_TIME_FMT);
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
