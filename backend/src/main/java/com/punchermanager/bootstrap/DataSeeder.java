package com.punchermanager.bootstrap;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.Punch;
import com.punchermanager.domain.PunchType;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.PunchRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.service.AttendanceService;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("!test")
public class DataSeeder implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
  private static final String DEMO_PW = "demo123";

  private final UserRepository userRepository;
  private final DepartmentRepository departmentRepository;
  private final TeamRepository teamRepository;
  private final PunchRepository punchRepository;
  private final AttendanceService attendanceService;
  private final PasswordEncoder passwordEncoder;

  public DataSeeder(
      UserRepository userRepository,
      DepartmentRepository departmentRepository,
      TeamRepository teamRepository,
      PunchRepository punchRepository,
      AttendanceService attendanceService,
      PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.departmentRepository = departmentRepository;
    this.teamRepository = teamRepository;
    this.punchRepository = punchRepository;
    this.attendanceService = attendanceService;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (userRepository.findByEmail("superadmin@puncher.com").isEmpty()) {
      seedCoreOrganization();
    }
    if (!userRepository.existsByEmployeeId("STUDY-ON-01")) {
      seedFictionalStudyAttendance();
    }
    seedFuturePunchesForKnownEmployees();
  }

  /** Original demo org: Super Admin, Engineering, Alpha Squad, one employee. */
  private void seedCoreOrganization() {
    log.info("Seeding default Super Admin and demo org data");

    User superAdmin = new User();
    superAdmin.setName("Super Admin");
    superAdmin.setEmail("superadmin@puncher.com");
    superAdmin.setPassword(passwordEncoder.encode("admin123"));
    superAdmin.setEmployeeId("SA001");
    superAdmin.setPhoneNumber("+1000000001");
    superAdmin.setHiringDate(LocalDate.of(2020, 1, 1));
    superAdmin.setStatus(UserStatus.ACTIVE);
    superAdmin.setRole(UserRole.SUPER_ADMIN);
    userRepository.save(superAdmin);

    User deptManager = new User();
    deptManager.setName("Alex Department Manager");
    deptManager.setEmail("deptmgr@puncher.com");
    deptManager.setPassword(passwordEncoder.encode(DEMO_PW));
    deptManager.setEmployeeId("DM001");
    deptManager.setPhoneNumber("+1000000002");
    deptManager.setHiringDate(LocalDate.of(2021, 3, 15));
    deptManager.setStatus(UserStatus.ACTIVE);
    deptManager.setRole(UserRole.DEPT_MANAGER);
    userRepository.save(deptManager);

    Department engineering = new Department();
    engineering.setName("Engineering");
    engineering.setDescription("Product engineering");
    engineering.setAdmin(deptManager);
    departmentRepository.save(engineering);

    deptManager.setDepartment(engineering);
    userRepository.save(deptManager);

    User teamLeader = new User();
    teamLeader.setName("Taylor Team Lead");
    teamLeader.setEmail("teamlead@puncher.com");
    teamLeader.setPassword(passwordEncoder.encode(DEMO_PW));
    teamLeader.setEmployeeId("TL001");
    teamLeader.setPhoneNumber("+1000000003");
    teamLeader.setHiringDate(LocalDate.of(2022, 6, 1));
    teamLeader.setStatus(UserStatus.ACTIVE);
    teamLeader.setRole(UserRole.TEAM_LEADER);
    teamLeader.setDepartment(engineering);
    userRepository.save(teamLeader);

    Team alpha = new Team();
    alpha.setName("Alpha Squad");
    alpha.setDepartment(engineering);
    alpha.setTeamLeader(teamLeader);
    teamRepository.save(alpha);

    teamLeader.setTeam(alpha);
    userRepository.save(teamLeader);

    User employee = new User();
    employee.setName("Jamie Employee");
    employee.setEmail("employee@puncher.com");
    employee.setPassword(passwordEncoder.encode(DEMO_PW));
    employee.setEmployeeId("EMP001");
    employee.setPhoneNumber("+1000000004");
    employee.setHiringDate(LocalDate.of(2023, 1, 10));
    employee.setStatus(UserStatus.ACTIVE);
    employee.setRole(UserRole.EMPLOYEE);
    employee.setDepartment(engineering);
    employee.setTeam(alpha);
    userRepository.save(employee);

    log.info(
        "Seeded users: superadmin@puncher.com / admin123; employee@puncher.com / {}; teamlead@puncher.com / {}",
        DEMO_PW,
        DEMO_PW);
  }

  /**
   * Extra fictional teams, leaders, and punch + attendance rows for studying Team attendance /
   * lateness (mock schedule Mon–Fri 09:00–17:00 when no weekly schedule exists).
   */
  private void seedFictionalStudyAttendance() {
    Department engineering =
        departmentRepository
            .findByName("Engineering")
            .orElseThrow(() -> new IllegalStateException("Engineering department missing"));
    ZoneId zone = ZoneId.systemDefault();
    LocalDate studyDay = previousWeekday(LocalDate.now(zone));

    log.info(
        "Seeding study attendance demo for {} ({}) — passwords: {}",
        studyDay,
        zone,
        DEMO_PW);

    record StudyTeamSpec(String teamName, String tlName, String tlEmail, String tlEmpId) {}

    StudyTeamSpec[] specs =
        new StudyTeamSpec[] {
          new StudyTeamSpec("Nebula Nine", "Riley Ortiz", "riley.nebula@study.local", "STUDY-TL-01"),
          new StudyTeamSpec(
              "Polaris Patrol", "Morgan Vega", "morgan.polaris@study.local", "STUDY-TL-02"),
          new StudyTeamSpec(
              "Quantum Quorum", "Casey Nguyen", "casey.quantum@study.local", "STUDY-TL-03")
        };

    for (StudyTeamSpec spec : specs) {
      User leader = new User();
      leader.setName(spec.tlName);
      leader.setEmail(spec.tlEmail);
      leader.setPassword(passwordEncoder.encode(DEMO_PW));
      leader.setEmployeeId(spec.tlEmpId);
      leader.setPhoneNumber("+19000000000");
      leader.setHiringDate(LocalDate.of(2022, 1, 1));
      leader.setStatus(UserStatus.ACTIVE);
      leader.setRole(UserRole.TEAM_LEADER);
      leader.setDepartment(engineering);
      userRepository.save(leader);

      Team team = new Team();
      team.setName(spec.teamName);
      team.setDepartment(engineering);
      team.setTeamLeader(leader);
      teamRepository.save(team);
      leader.setTeam(team);
      userRepository.save(leader);

      // Employees: names match scenario for team attendance table
      if (spec.teamName.equals("Nebula Nine")) {
        User onTime =
            employee(
                engineering,
                team,
                "Jordan Lee (on time)",
                "jordan.nebula@study.local",
                "STUDY-ON-01");
        User late =
            employee(
                engineering,
                team,
                "Sam Rivera (late start)",
                "sam.nebula@study.local",
                "STUDY-LATE-01");
        seedShiftWithEvaluation(onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0));
        seedShiftWithEvaluation(late, studyDay, zone, LocalTime.of(9, 25), LocalTime.of(17, 0));
      } else if (spec.teamName.equals("Polaris Patrol")) {
        User onTime =
            employee(
                engineering,
                team,
                "Alex Kim (on time)",
                "alex.polaris@study.local",
                "STUDY-ON-02");
        User late =
            employee(
                engineering,
                team,
                "Taylor Brooks (late start)",
                "taylor.polaris@study.local",
                "STUDY-LATE-02");
        seedShiftWithEvaluation(onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0));
        seedShiftWithEvaluation(late, studyDay, zone, LocalTime.of(9, 18), LocalTime.of(17, 0));
      } else {
        User onTime =
            employee(
                engineering,
                team,
                "Jamie Chen (on time)",
                "jamie.quantum@study.local",
                "STUDY-ON-03");
        User grace =
            employee(
                engineering,
                team,
                "Avery Park (within grace)",
                "avery.quantum@study.local",
                "STUDY-GRACE-01");
        User late =
            employee(
                engineering,
                team,
                "River Santos (very late)",
                "river.quantum@study.local",
                "STUDY-LATE-03");
        seedShiftWithEvaluation(onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0));
        seedShiftWithEvaluation(grace, studyDay, zone, LocalTime.of(9, 8), LocalTime.of(17, 0));
        seedShiftWithEvaluation(late, studyDay, zone, LocalTime.of(9, 52), LocalTime.of(17, 15));
      }
    }

    log.info(
        "Study data: teams Nebula Nine, Polaris Patrol, Quantum Quorum — pick date {} in Team attendance",
        studyDay);
    log.info(
        "Sample logins (password {}): jordan.nebula@study.local (on-time), sam.nebula@study.local (late)",
        DEMO_PW);
  }

  private static LocalDate previousWeekday(LocalDate d) {
    LocalDate x = d.minusDays(1);
    while (x.getDayOfWeek() == DayOfWeek.SATURDAY || x.getDayOfWeek() == DayOfWeek.SUNDAY) {
      x = x.minusDays(1);
    }
    return x;
  }

  private User employee(Department dept, Team team, String name, String email, String empId) {
    User u = new User();
    u.setName(name);
    u.setEmail(email);
    u.setPassword(passwordEncoder.encode(DEMO_PW));
    u.setEmployeeId(empId);
    u.setPhoneNumber("+19005550000");
    u.setHiringDate(LocalDate.of(2023, 6, 1));
    u.setStatus(UserStatus.ACTIVE);
    u.setRole(UserRole.EMPLOYEE);
    u.setDepartment(dept);
    u.setTeam(team);
    return userRepository.save(u);
  }

  /**
   * Minimal valid day: WORK_START + LOGOUT, then attendance evaluation (matches Planning mock 09:00
   * expected).
   */
  private void seedShiftWithEvaluation(
      User employee, LocalDate day, ZoneId zone, LocalTime workStart, LocalTime logout) {
    Instant ws = day.atTime(workStart).atZone(zone).toInstant();
    Instant lo = day.atTime(logout).atZone(zone).toInstant();
    savePunch(employee, ws, PunchType.WORK_START);
    savePunch(employee, lo, PunchType.LOGOUT);
    attendanceService.evaluateAfterLogout(employee, day);
  }

  private void savePunch(User user, Instant when, PunchType type) {
    Punch p = new Punch();
    p.setUser(user);
    p.setPunchType(type);
    p.setPunchedAt(when);
    punchRepository.save(p);
  }

  /**
   * Seeds future-dated punches for existing employees to make it easy to demo/export/verify
   * behavior. Idempotent: if a day already has WORK_START, we skip that day.
   */
  private void seedFuturePunchesForKnownEmployees() {
    // Employee IDs provided by user (Directory list)
    List<String> empIds =
        List.of(
            "EMP001",
            "demo123",
            "1qw2w",
            "w12321",
            "p123321345",
            "p123321",
            "p12332134",
            "STUDY-ON-01",
            "STUDY-LATE-01",
            "STUDY-ON-02",
            "STUDY-LATE-02",
            "STUDY-GRACE-01",
            "STUDY-LATE-03",
            "elmaarpro756",
            "employee8",
            "rimemp12",
            "STUDY-ON-03");

    ZoneId zone = ZoneId.systemDefault();
    // Seed the last ~2 months plus a few weeks in the future.
    LocalDate start = LocalDate.now(zone).minusDays(62);
    LocalDate end = LocalDate.now(zone).plusDays(35); // ~5 weeks ahead, weekends skipped

    int seeded = 0;
    int skipped = 0;
    for (String empId : empIds) {
      Optional<User> opt = userRepository.findByEmployeeId(empId);
      if (opt.isEmpty()) continue;
      User u = opt.get();

      for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
        if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
          continue;
        }

        Instant from = day.atStartOfDay(zone).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(zone).toInstant();
        if (punchRepository
            .findFirstByUserIdAndPunchTypeAndPunchedAtBetween(u.getId(), PunchType.WORK_START, from, to)
            .isPresent()) {
          skipped++;
          continue;
        }

        // Deterministic variation per employee/day (no randomness needed).
        int h = 9;
        int baseStartMin = 0;
        int salt = Math.abs((empId + "|" + day).hashCode());
        int grace = u.getDepartment() != null && u.getDepartment().getLateGraceMinutes() != null
            ? Math.max(0, Math.min(120, u.getDepartment().getLateGraceMinutes()))
            : 10;

        int startOffset;
        if (salt % 6 == 0) startOffset = 0; // on time
        else if (salt % 6 == 1) startOffset = Math.min(5, grace); // within grace
        else if (salt % 6 == 2) startOffset = grace + 3; // slightly late
        else if (salt % 6 == 3) startOffset = grace + 15; // late
        else if (salt % 6 == 4) startOffset = 12; // a bit late regardless
        else startOffset = 2; // near on-time

        LocalTime wsTime = LocalTime.of(h, baseStartMin).plusMinutes(startOffset);
        LocalTime break1Start = wsTime.plusHours(2).plusMinutes(5);
        int b1Len = 8 + (salt % 8); // 8..15
        LocalTime break1End = break1Start.plusMinutes(b1Len);

        LocalTime lunchStart = wsTime.plusHours(4);
        int lunchLen =
            u.getDepartment() != null && u.getDepartment().getAllowedLunchMinutes() != null
                ? Math.max(0, Math.min(300, u.getDepartment().getAllowedLunchMinutes()))
                : 30;
        // Slightly vary lunch length up to +10m
        int lunchLenVar = Math.min(10, salt % 11);
        LocalTime lunchEnd = lunchStart.plusMinutes(lunchLen + lunchLenVar);

        LocalTime break2Start = wsTime.plusHours(6).plusMinutes(10);
        int b2Len = 6 + (salt % 7); // 6..12
        LocalTime break2End = break2Start.plusMinutes(b2Len);

        // End of shift around 8h workday (not subtracting breaks/lunch precisely; it's demo data).
        LocalTime logout = wsTime.plusHours(8).plusMinutes(10 + (salt % 25));

        savePunch(u, day.atTime(wsTime).atZone(zone).toInstant(), PunchType.WORK_START);
        savePunch(u, day.atTime(break1Start).atZone(zone).toInstant(), PunchType.BREAK1_START);
        savePunch(u, day.atTime(break1End).atZone(zone).toInstant(), PunchType.BREAK1_END);
        savePunch(u, day.atTime(lunchStart).atZone(zone).toInstant(), PunchType.LUNCH_START);
        savePunch(u, day.atTime(lunchEnd).atZone(zone).toInstant(), PunchType.LUNCH_END);
        savePunch(u, day.atTime(break2Start).atZone(zone).toInstant(), PunchType.BREAK2_START);
        savePunch(u, day.atTime(break2End).atZone(zone).toInstant(), PunchType.BREAK2_END);
        savePunch(u, day.atTime(logout).atZone(zone).toInstant(), PunchType.LOGOUT);
        seeded++;
      }
    }

    if (seeded > 0) {
      log.info("Seeded {} future punch-days (skipped {} existing)", seeded, skipped);
    }
  }
}
