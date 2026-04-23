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
}
