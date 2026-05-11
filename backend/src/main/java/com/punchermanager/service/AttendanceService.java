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
import com.punchermanager.repository.DepartmentRepository;
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
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.punchermanager.web.dto.AttendanceAbsentEmployeeDto;
import com.punchermanager.web.dto.AttendanceAnalyticsPointDto;
import com.punchermanager.web.dto.AttendanceAnalyticsResponseDto;
import com.punchermanager.web.dto.AttendanceLateDayDto;
import com.punchermanager.web.dto.AttendanceLateEmployeeDto;

@Service
public class AttendanceService {

  private static final ZoneId ZONE = ZoneId.systemDefault();
  private static final DateTimeFormatter SCHEDULE_TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
  private static final int DEFAULT_LATE_GRACE_MINUTES = 10;
  /** Minutes before scheduled end considered too early for logout. */
  private static final int END_EARLY_TOLERANCE_MINUTES = 30;
  /** Minutes after scheduled end allowed before flagging late end. */
  private static final int END_LATE_TOLERANCE_MINUTES = 60;

  private final AttendanceRecordRepository attendanceRecordRepository;
  private final PlanningService planningService;
  private final PunchRepository punchRepository;
  private final UserRepository userRepository;
  private final TeamRepository teamRepository;
  private final DepartmentRepository departmentRepository;

  public AttendanceService(
      AttendanceRecordRepository attendanceRecordRepository,
      PlanningService planningService,
      PunchRepository punchRepository,
      UserRepository userRepository,
      TeamRepository teamRepository,
      DepartmentRepository departmentRepository) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.planningService = planningService;
    this.punchRepository = punchRepository;
    this.userRepository = userRepository;
    this.teamRepository = teamRepository;
    this.departmentRepository = departmentRepository;
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
    int graceMinutes = graceMinutesFor(employee);
    Instant latestAllowedStart = expectedInstant.plus(graceMinutes, ChronoUnit.MINUTES);
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

      DerivedAttendance derived =
          att == null
              ? deriveFromPunchesIfPossible(
                  u.getEmployeeId(), date, punchDtos, zone, graceMinutesFor(u))
              : null;

      Boolean scheduleOk = null;
      String scheduleNote = null;
      if (scheduleVsPlanCheck) {
        ScheduleVsPlanResult check =
            verifyScheduleVsPunches(u.getEmployeeId(), date, punchDtos, zone, graceMinutesFor(u));
        scheduleOk = check.ok();
        scheduleNote = check.note();
      }

      rows.add(
          new AttendanceRowDto(
              u.getId(),
              u.getName(),
              u.getEmployeeId(),
              u.getDepartment() != null ? u.getDepartment().getName() : null,
              u.getTeam() != null ? u.getTeam().getName() : null,
              u.getDepartment() != null && u.getDepartment().getAdmin() != null
                  ? u.getDepartment().getAdmin().getName()
                  : null,
              u.getTeam() != null && u.getTeam().getTeamLeader() != null
                  ? u.getTeam().getTeamLeader().getName()
                  : null,
              u.getTeam() != null && u.getTeam().getTeamLeader() != null
                  ? u.getTeam().getTeamLeader().getEmail()
                  : null,
              u.getDepartment() != null && u.getDepartment().getAdmin() != null
                  ? u.getDepartment().getAdmin().getEmail()
                  : null,
              date,
              att != null ? att.getStatus() : (derived != null ? derived.status() : null),
              att != null ? att.getExpectedStart() : (derived != null ? derived.expectedStart() : null),
              att != null ? att.getActualStart() : (derived != null ? derived.actualStart() : null),
              att != null ? att.getMinutesLate() : (derived != null ? derived.minutesLate() : null),
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
    return usersAttendanceRange(members, from, to, requester, zone);
  }

  @Transactional(readOnly = true)
  public List<AttendanceRowDto> departmentAttendanceRange(
      UUID departmentId, LocalDate from, LocalDate to, User requester, ZoneId zone) {
    if (from.isAfter(to)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid date range");
    }
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    if (days > 62) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Range too large (max 62 days)");
    }

    var dept =
        departmentRepository
            .findById(departmentId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Department not found"));

    switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case DEPT_MANAGER, TEAM_LEADER -> {
        if (requester.getDepartment() == null
            || !requester.getDepartment().getId().equals(dept.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Department not in your scope");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }

    List<User> members = userRepository.findEmployeesByDepartmentId(departmentId);
    return usersAttendanceRange(members, from, to, requester, zone);
  }

  @Transactional(readOnly = true)
  public List<AttendanceRowDto> allAttendanceRange(
      LocalDate from, LocalDate to, User requester, ZoneId zone) {
    if (requester.getRole() != UserRole.SUPER_ADMIN && requester.getRole() != UserRole.ADMIN) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
    if (from.isAfter(to)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid date range");
    }
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    if (days > 62) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Range too large (max 62 days)");
    }
    List<User> members =
        userRepository.findAll().stream().filter(u -> u.getRole() == UserRole.EMPLOYEE).toList();
    return usersAttendanceRange(members, from, to, requester, zone);
  }

  private List<AttendanceRowDto> usersAttendanceRange(
      List<User> members, LocalDate from, LocalDate to, User requester, ZoneId zone) {
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

        DerivedAttendance derived =
            att == null
                ? deriveFromPunchesIfPossible(
                    u.getEmployeeId(), day, punchDtos, zone, graceMinutesFor(u))
                : null;

        Boolean scheduleOk = null;
        String scheduleNote = null;
        if (scheduleVsPlanCheck) {
          ScheduleVsPlanResult check =
              verifyScheduleVsPunches(u.getEmployeeId(), day, punchDtos, zone, graceMinutesFor(u));
          scheduleOk = check.ok();
          scheduleNote = check.note();
        }

        out.add(
            new AttendanceRowDto(
                u.getId(),
                u.getName(),
                u.getEmployeeId(),
                u.getDepartment() != null ? u.getDepartment().getName() : null,
                u.getTeam() != null ? u.getTeam().getName() : null,
                u.getDepartment() != null && u.getDepartment().getAdmin() != null
                    ? u.getDepartment().getAdmin().getName()
                    : null,
                u.getTeam() != null && u.getTeam().getTeamLeader() != null
                    ? u.getTeam().getTeamLeader().getName()
                    : null,
                u.getTeam() != null && u.getTeam().getTeamLeader() != null
                    ? u.getTeam().getTeamLeader().getEmail()
                    : null,
                u.getDepartment() != null && u.getDepartment().getAdmin() != null
                    ? u.getDepartment().getAdmin().getEmail()
                    : null,
                day,
                att != null ? att.getStatus() : (derived != null ? derived.status() : null),
                att != null ? att.getExpectedStart() : (derived != null ? derived.expectedStart() : null),
                att != null ? att.getActualStart() : (derived != null ? derived.actualStart() : null),
                att != null ? att.getMinutesLate() : (derived != null ? derived.minutesLate() : null),
                punchDtos,
                scheduleOk,
                scheduleNote));
      }
    }
    return out;
  }

  private record DerivedAttendance(
      AttendanceStatus status, LocalTime expectedStart, LocalTime actualStart, Integer minutesLate) {}

  /**
   * For in-progress days (no LOGOUT yet) we still want a meaningful status:
   * - ON_TIME if first WORK_START is at/before scheduled start
   * - LATE if first WORK_START is after scheduled start
   */
  private DerivedAttendance deriveFromPunchesIfPossible(
      String employeeId,
      LocalDate date,
      List<PunchResponse> sortedPunches,
      ZoneId zone,
      int graceMinutes) {
    if (sortedPunches == null || sortedPunches.isEmpty()) return null;
    var planOpt = planningService.getPlannedDay(employeeId, date);
    if (planOpt.isEmpty()) return null;
    PlanningResponseDto plan = planOpt.get();
    LocalTime expectedStart = plan.expectedStartTime();

    PunchResponse firstWorkStart =
        sortedPunches.stream().filter(p -> p.type() == PunchType.WORK_START).findFirst().orElse(null);
    if (firstWorkStart == null) return null;

    LocalTime actualStart = LocalTime.ofInstant(firstWorkStart.punchedAt(), zone);
    // Compare Instants to avoid local-time edge cases and keep behavior timezone-correct.
    Instant scheduledStart = expectedStart.atDate(date).atZone(zone).toInstant();
    long minutesDiff = ChronoUnit.MINUTES.between(scheduledStart, firstWorkStart.punchedAt());
    boolean late = minutesDiff > graceMinutes;
    return new DerivedAttendance(
        late ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
        expectedStart,
        actualStart,
        late ? (int) Math.max(0L, minutesDiff) : 0);
  }

  private static int graceMinutesFor(User employee) {
    if (employee == null) return DEFAULT_LATE_GRACE_MINUTES;
    if (employee.getDepartment() == null) return DEFAULT_LATE_GRACE_MINUTES;
    Integer m = employee.getDepartment().getLateGraceMinutes();
    if (m == null) return DEFAULT_LATE_GRACE_MINUTES;
    if (m < 0) return 0;
    if (m > 120) return 120;
    return m;
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
   * Compares {@link PlanningService} day plan (confirmed weekly schedule only) to first {@link
   * PunchType#WORK_START} and last {@link PunchType#LOGOUT} for the calendar day.
   */
  private ScheduleVsPlanResult verifyScheduleVsPunches(
      String employeeId,
      LocalDate date,
      List<PunchResponse> sortedPunches,
      ZoneId zone,
      int graceMinutes) {

    var planOpt = planningService.getPlannedDay(employeeId, date);
    boolean weekConfirmed = planningService.hasConfirmedScheduleForWeek(employeeId, date);

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
        if (weekConfirmed) {
          return new ScheduleVsPlanResult(
              false,
              "Punched on scheduled day off (WORK_START "
                  + fmtInstantLocal(firstWorkStart.punchedAt(), zone)
                  + ")");
        }
        return new ScheduleVsPlanResult(
            false,
            "WORK_START with no confirmed weekly schedule for this week ("
                + fmtInstantLocal(firstWorkStart.punchedAt(), zone)
                + ")");
      }
      if (weekConfirmed) {
        return new ScheduleVsPlanResult(true, "OK (day off)");
      }
      return new ScheduleVsPlanResult(true, "No confirmed weekly schedule for this week (not evaluated)");
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
    Instant latestAllowedStart = scheduledStart.plus(graceMinutes, ChronoUnit.MINUTES);
    if (firstWorkStart.punchedAt().isAfter(latestAllowedStart)) {
      return new ScheduleVsPlanResult(
          false,
          "Late start: WORK_START "
              + fmtInstantLocal(firstWorkStart.punchedAt(), zone)
              + " vs scheduled "
              + fmtTime(expectedStart)
              + " (+"
              + graceMinutes
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

  @Transactional(readOnly = true)
  public AttendanceAnalyticsResponseDto analytics(
      LocalDate from,
      LocalDate to,
      UUID employeeUserId,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    List<AttendanceRowDto> rows =
        resolveAnalyticsRows(from, to, employeeUserId, departmentId, teamId, requester, zone);
    return buildAnalytics(from, to, rows, zone);
  }

  private List<AttendanceRowDto> resolveAnalyticsRows(
      LocalDate from,
      LocalDate to,
      UUID employeeUserId,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    validateAnalyticsDateRange(from, to);
    if (employeeUserId != null) {
      return analyticsRowsForEmployee(from, to, employeeUserId, requester, zone);
    }
    return analyticsRowsForGroup(from, to, departmentId, teamId, requester, zone);
  }

  @Transactional(readOnly = true)
  public List<AttendanceLateEmployeeDto> analyticsLateEmployees(
      LocalDate from,
      LocalDate to,
      UUID employeeUserId,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    List<AttendanceRowDto> rows =
        resolveAnalyticsRows(from, to, employeeUserId, departmentId, teamId, requester, zone);
    Map<UUID, LateAgg> byUser = new HashMap<>();
    for (AttendanceRowDto r : rows) {
      if (r == null || r.status() != AttendanceStatus.LATE) continue;
      LateAgg a =
          byUser.computeIfAbsent(
              r.userId(),
              uid ->
                  new LateAgg(
                      r.name(),
                      r.employeeId(),
                      r.departmentName(),
                      r.teamName()));
      int ml = r.minutesLate() != null ? r.minutesLate() : 0;
      a.totalLateMinutes += ml;
      a.lateDayCount += 1;
    }
    return byUser.entrySet().stream()
        .map(
            e ->
                new AttendanceLateEmployeeDto(
                    e.getKey(),
                    e.getValue().name,
                    e.getValue().employeeId,
                    e.getValue().departmentName,
                    e.getValue().teamName,
                    e.getValue().totalLateMinutes,
                    e.getValue().lateDayCount))
        .sorted(Comparator.comparingInt(AttendanceLateEmployeeDto::totalLateMinutes).reversed())
        .toList();
  }

  /**
   * Late attendance rows for one employee in {@code [from, to]} (same permission rules as
   * {@link #analyticsRowsForEmployee}).
   */
  @Transactional(readOnly = true)
  public List<AttendanceLateDayDto> analyticsLateDaysForEmployee(
      LocalDate from, LocalDate to, UUID userId, User requester, ZoneId zone) {
    validateAnalyticsDateRange(from, to);
    List<AttendanceRowDto> rows = analyticsRowsForEmployee(from, to, userId, requester, zone);
    return rows.stream()
        .filter(r -> r != null && r.status() == AttendanceStatus.LATE && r.recordDate() != null)
        .map(
            r ->
                new AttendanceLateDayDto(
                    r.recordDate(), r.minutesLate() != null ? r.minutesLate() : 0))
        .sorted(Comparator.comparing(AttendanceLateDayDto::recordDate).reversed())
        .toList();
  }

  @Transactional(readOnly = true)
  public List<AttendanceAbsentEmployeeDto> analyticsAbsentEmployees(
      LocalDate from,
      LocalDate to,
      UUID employeeUserId,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    List<AttendanceRowDto> rows =
        resolveAnalyticsRows(from, to, employeeUserId, departmentId, teamId, requester, zone);
    Map<UUID, AbsAgg> byUser = new HashMap<>();
    for (AttendanceRowDto r : rows) {
      if (r == null || r.status() != AttendanceStatus.ABSENT || r.recordDate() == null) continue;
      AbsAgg a = byUser.computeIfAbsent(r.userId(), uid -> new AbsAgg(r));
      a.days.add(r.recordDate());
    }
    return byUser.entrySet().stream()
        .map(
            e -> {
              AbsAgg a = e.getValue();
              ArrayList<LocalDate> dates = new ArrayList<>(a.days);
              return new AttendanceAbsentEmployeeDto(
                  e.getKey(),
                  a.name,
                  a.employeeId,
                  a.departmentName,
                  a.teamName,
                  dates.size(),
                  dates);
            })
        .sorted(
            Comparator.comparingInt(AttendanceAbsentEmployeeDto::absentDayCount)
                .reversed()
                .thenComparing(AttendanceAbsentEmployeeDto::name, Comparator.nullsLast(String::compareToIgnoreCase)))
        .toList();
  }

  private static final class LateAgg {
    final String name;
    final String employeeId;
    final String departmentName;
    final String teamName;
    int totalLateMinutes;
    int lateDayCount;

    LateAgg(String name, String employeeId, String departmentName, String teamName) {
      this.name = name;
      this.employeeId = employeeId;
      this.departmentName = departmentName;
      this.teamName = teamName;
    }
  }

  private static final class AbsAgg {
    final String name;
    final String employeeId;
    final String departmentName;
    final String teamName;
    final TreeSet<LocalDate> days = new TreeSet<>();

    AbsAgg(AttendanceRowDto r) {
      this.name = r.name();
      this.employeeId = r.employeeId();
      this.departmentName = r.departmentName();
      this.teamName = r.teamName();
    }
  }

  private static void validateAnalyticsDateRange(LocalDate from, LocalDate to) {
    if (from == null || to == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "from and to are required");
    }
    if (from.isAfter(to)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid date range");
    }
    long days = ChronoUnit.DAYS.between(from, to) + 1;
    if (days > 62) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Range too large (max 62 days)");
    }
  }

  private List<AttendanceRowDto> analyticsRowsForEmployee(
      LocalDate from, LocalDate to, UUID employeeUserId, User requester, ZoneId zone) {
    User employee =
        userRepository
            .findByIdWithContext(employeeUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (employee.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Target user must be EMPLOYEE");
    }
    switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case DEPT_MANAGER -> {
        if (requester.getDepartment() == null
            || employee.getDepartment() == null
            || !requester.getDepartment().getId().equals(employee.getDepartment().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Employee outside your department");
        }
      }
      case TEAM_LEADER -> {
        if (requester.getTeam() == null
            || employee.getTeam() == null
            || !requester.getTeam().getId().equals(employee.getTeam().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Employee outside your team");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
    return usersAttendanceRange(List.of(employee), from, to, requester, zone);
  }

  private List<AttendanceRowDto> analyticsRowsForGroup(
      LocalDate from,
      LocalDate to,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    return switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN ->
          analyticsRowsAdminScoped(from, to, departmentId, teamId, requester, zone);
      case DEPT_MANAGER ->
          analyticsRowsDeptManagerScoped(from, to, departmentId, teamId, requester, zone);
      case TEAM_LEADER ->
          analyticsRowsTeamLeaderScoped(from, to, departmentId, teamId, requester, zone);
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    };
  }

  private List<AttendanceRowDto> analyticsRowsAdminScoped(
      LocalDate from,
      LocalDate to,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    if (teamId != null) {
      Team team =
          teamRepository
              .findByIdFetched(teamId)
              .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
      if (departmentId != null && !team.getDepartment().getId().equals(departmentId)) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "Team does not belong to selected department");
      }
      return teamAttendanceRange(teamId, from, to, requester, zone);
    }
    if (departmentId != null) {
      return departmentAttendanceRange(departmentId, from, to, requester, zone);
    }
    return allAttendanceRange(from, to, requester, zone);
  }

  private List<AttendanceRowDto> analyticsRowsDeptManagerScoped(
      LocalDate from,
      LocalDate to,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    if (requester.getDepartment() == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "No department assigned");
    }
    UUID myDeptId = requester.getDepartment().getId();
    if (departmentId != null && !departmentId.equals(myDeptId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Department not in your scope");
    }
    if (teamId != null) {
      Team team =
          teamRepository
              .findByIdFetched(teamId)
              .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
      if (!team.getDepartment().getId().equals(myDeptId)) {
        throw new ApiException(HttpStatus.FORBIDDEN, "Team not in your department");
      }
      return teamAttendanceRange(teamId, from, to, requester, zone);
    }
    return departmentAttendanceRange(myDeptId, from, to, requester, zone);
  }

  private List<AttendanceRowDto> analyticsRowsTeamLeaderScoped(
      LocalDate from,
      LocalDate to,
      UUID departmentId,
      UUID teamId,
      User requester,
      ZoneId zone) {
    if (requester.getTeam() == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "No team assigned");
    }
    UUID myTeamId = requester.getTeam().getId();
    Team myTeam =
        teamRepository
            .findByIdFetched(myTeamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    UUID myDeptId = myTeam.getDepartment().getId();
    if (departmentId != null && !departmentId.equals(myDeptId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Department not in your scope");
    }
    if (teamId != null && !teamId.equals(myTeamId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Team not in your scope");
    }
    return teamAttendanceRange(myTeamId, from, to, requester, zone);
  }

  private AttendanceAnalyticsResponseDto buildAnalytics(
      LocalDate from, LocalDate to, List<AttendanceRowDto> rows, ZoneId zone) {
    int total = 0;
    int onTime = 0;
    int late = 0;
    int absent = 0;
    double workHoursSum = 0d;
    int workHoursCount = 0;
    Map<LocalDate, Bucket> daily = new LinkedHashMap<>();
    for (AttendanceRowDto r : rows) {
      if (r == null || r.recordDate() == null) continue;
      if (r.status() == null) continue; // Option A: only count existing/derived statuses
      total += 1;
      Bucket b = daily.computeIfAbsent(r.recordDate(), d -> new Bucket());
      switch (r.status()) {
        case ON_TIME -> {
          onTime += 1;
          b.onTime += 1;
        }
        case LATE -> {
          late += 1;
          b.late += 1;
          Long wm = computeWorkMinutes(r, zone);
          if (wm != null && wm > 0) {
            b.lateWorkMinutesSum += wm;
            int ml = r.minutesLate() != null ? r.minutesLate() : 0;
            b.lateMinutesLateSum += ml;
          }
        }
        case ABSENT -> {
          absent += 1;
          b.absent += 1;
        }
      }

      Double hours = computeWorkHours(r, zone);
      if (hours != null) {
        workHoursSum += hours;
        workHoursCount += 1;
        b.workHoursSum += hours;
        b.workHoursCount += 1;
      }
    }

    int presentCount = onTime + late;
    double presentPct = pct(presentCount, total);
    double latePct = pct(late, total);
    double absentPct = pct(absent, total);
    Double avgWorkHours = workHoursCount > 0 ? workHoursSum / workHoursCount : null;

    List<AttendanceAnalyticsPointDto> dailyPoints = aggregateByDay(from, to, daily);
    List<AttendanceAnalyticsPointDto> weekly = aggregateByWeek(daily);
    List<AttendanceAnalyticsPointDto> monthly = aggregateByMonth(daily);

    return new AttendanceAnalyticsResponseDto(
        from,
        to,
        total,
        presentCount,
        late,
        absent,
        presentPct,
        latePct,
        absentPct,
        avgWorkHours,
        dailyPoints,
        weekly,
        monthly);
  }

  private static double pct(int numerator, int denom) {
    if (denom <= 0) return 0d;
    return (numerator * 100d) / denom;
  }

  private static Double computeWorkHours(AttendanceRowDto r, ZoneId zone) {
    Long m = computeWorkMinutes(r, zone);
    if (m == null || m <= 0) return null;
    return m / 60d;
  }

  /** Minutes from first WORK_START to LOGOUT for that calendar day (same basis as work-hours KPI). */
  private static Long computeWorkMinutes(AttendanceRowDto r, ZoneId zone) {
    if (r.punches() == null || r.punches().isEmpty()) return null;
    PunchResponse firstWorkStart =
        r.punches().stream().filter(p -> p.type() == PunchType.WORK_START).findFirst().orElse(null);
    PunchResponse lastLogout = null;
    for (int i = r.punches().size() - 1; i >= 0; i--) {
      PunchResponse p = r.punches().get(i);
      if (p.type() == PunchType.LOGOUT) {
        lastLogout = p;
        break;
      }
    }
    if (firstWorkStart == null || lastLogout == null) return null;
    long minutes = Duration.between(firstWorkStart.punchedAt(), lastLogout.punchedAt()).toMinutes();
    if (minutes <= 0) return null;
    return minutes;
  }

  private static final class Bucket {
    int onTime;
    int late;
    int absent;
    double workHoursSum;
    int workHoursCount;
    long lateMinutesLateSum;
    long lateWorkMinutesSum;
  }

  private static AttendanceAnalyticsPointDto toPoint(LocalDate periodStart, Bucket b) {
    int tot = b.onTime + b.late + b.absent;
    Double avgHours = b.workHoursCount > 0 ? b.workHoursSum / b.workHoursCount : null;
    Double lateTimeVsWorkPct = null;
    if (b.late > 0 && b.lateWorkMinutesSum > 0) {
      lateTimeVsWorkPct = Math.min(100d, (b.lateMinutesLateSum * 100d) / b.lateWorkMinutesSum);
    }
    return new AttendanceAnalyticsPointDto(
        periodStart,
        pct(b.onTime, tot),
        pct(b.late, tot),
        pct(b.absent, tot),
        avgHours,
        lateTimeVsWorkPct);
  }

  private static List<AttendanceAnalyticsPointDto> aggregateByDay(
      LocalDate from, LocalDate to, Map<LocalDate, Bucket> dailyMap) {
    List<AttendanceAnalyticsPointDto> out = new ArrayList<>();
    for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
      Bucket b = dailyMap.getOrDefault(d, new Bucket());
      out.add(toPoint(d, b));
    }
    return out;
  }

  private static List<AttendanceAnalyticsPointDto> aggregateByWeek(Map<LocalDate, Bucket> daily) {
    Map<LocalDate, Bucket> byWeek = new LinkedHashMap<>();
    for (Map.Entry<LocalDate, Bucket> e : daily.entrySet()) {
      LocalDate weekStart = e.getKey().with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
      Bucket src = e.getValue();
      Bucket b = byWeek.computeIfAbsent(weekStart, k -> new Bucket());
      b.onTime += src.onTime;
      b.late += src.late;
      b.absent += src.absent;
      b.workHoursSum += src.workHoursSum;
      b.workHoursCount += src.workHoursCount;
      b.lateMinutesLateSum += src.lateMinutesLateSum;
      b.lateWorkMinutesSum += src.lateWorkMinutesSum;
    }
    List<AttendanceAnalyticsPointDto> out = new ArrayList<>();
    for (Map.Entry<LocalDate, Bucket> e : byWeek.entrySet()) {
      out.add(toPoint(e.getKey(), e.getValue()));
    }
    out.sort(Comparator.comparing(AttendanceAnalyticsPointDto::periodStart));
    return out;
  }

  private static List<AttendanceAnalyticsPointDto> aggregateByMonth(Map<LocalDate, Bucket> daily) {
    Map<LocalDate, Bucket> byMonth = new LinkedHashMap<>();
    for (Map.Entry<LocalDate, Bucket> e : daily.entrySet()) {
      LocalDate monthStart = e.getKey().withDayOfMonth(1);
      Bucket src = e.getValue();
      Bucket b = byMonth.computeIfAbsent(monthStart, k -> new Bucket());
      b.onTime += src.onTime;
      b.late += src.late;
      b.absent += src.absent;
      b.workHoursSum += src.workHoursSum;
      b.workHoursCount += src.workHoursCount;
      b.lateMinutesLateSum += src.lateMinutesLateSum;
      b.lateWorkMinutesSum += src.lateWorkMinutesSum;
    }
    List<AttendanceAnalyticsPointDto> out = new ArrayList<>();
    for (Map.Entry<LocalDate, Bucket> e : byMonth.entrySet()) {
      out.add(toPoint(e.getKey(), e.getValue()));
    }
    out.sort(Comparator.comparing(AttendanceAnalyticsPointDto::periodStart));
    return out;
  }
}
