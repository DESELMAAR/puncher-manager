package com.punchermanager.bootstrap;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.Punch;
import com.punchermanager.domain.PunchType;
import com.punchermanager.domain.ScheduleConfirmation;
import com.punchermanager.domain.ScheduleConfirmationStatus;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.domain.WeeklySchedule;
import com.punchermanager.domain.WeeklyScheduleDay;
import com.punchermanager.repository.AttendanceRecordRepository;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.PunchRepository;
import com.punchermanager.repository.ScheduleConfirmationRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.repository.WeeklyScheduleRepository;
import com.punchermanager.service.AttendanceService;
import com.punchermanager.service.ScheduleService;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Profile("!test")
public class DataSeeder implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
  private static final String DEMO_PW = "demo123";

  /**
   * Safety switch: seeding is opt-in. Enable with:
   * - env: PUNCHER_SEED_ENABLED=true
   * - or property: puncher.seed.enabled=true
   */
  @Value("${puncher.seed.enabled:false}")
  private boolean seedEnabled;

  /** If true, we generate/update {@code attendance_records} from seeded punches. */
  @Value("${puncher.seed.generateAttendanceRecords:true}")
  private boolean generateAttendanceRecords;

  /**
   * If true, seed extra departments/teams/employees prefixed with {@code ANALYTICS-} for Power BI
   * (Human Resources, Operations, Sales & Marketing).
   */
  @Value("${puncher.seed.analytics:true}")
  private boolean seedAnalytics;

  @Value("${spring.datasource.url:unknown}")
  private String datasourceUrl;

  private final UserRepository userRepository;
  private final DepartmentRepository departmentRepository;
  private final TeamRepository teamRepository;
  private final PunchRepository punchRepository;
  private final WeeklyScheduleRepository weeklyScheduleRepository;
  private final ScheduleConfirmationRepository scheduleConfirmationRepository;
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final AttendanceService attendanceService;
  private final PasswordEncoder passwordEncoder;
  private final TransactionTemplate transactionTemplate;

  public DataSeeder(
      UserRepository userRepository,
      DepartmentRepository departmentRepository,
      TeamRepository teamRepository,
      PunchRepository punchRepository,
      WeeklyScheduleRepository weeklyScheduleRepository,
      ScheduleConfirmationRepository scheduleConfirmationRepository,
      AttendanceRecordRepository attendanceRecordRepository,
      AttendanceService attendanceService,
      PasswordEncoder passwordEncoder,
      PlatformTransactionManager transactionManager) {
    this.userRepository = userRepository;
    this.departmentRepository = departmentRepository;
    this.teamRepository = teamRepository;
    this.punchRepository = punchRepository;
    this.weeklyScheduleRepository = weeklyScheduleRepository;
    this.scheduleConfirmationRepository = scheduleConfirmationRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.attendanceService = attendanceService;
    this.passwordEncoder = passwordEncoder;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!seedEnabled) {
      log.info("DataSeeder: disabled (set puncher.seed.enabled=true to run)");
      return;
    }
    log.info("DataSeeder: using datasource {}", datasourceUrl);
    if (userRepository.findByEmail("superadmin@puncher.com").isEmpty()) {
      transactionTemplate.executeWithoutResult(status -> seedCoreOrganization());
    }
    if (!userRepository.existsByEmployeeId("STUDY-ON-01")) {
      transactionTemplate.executeWithoutResult(status -> seedFictionalStudyAttendance());
    }
    if (seedAnalytics && !userRepository.existsByEmployeeId("ANALYTICS-DM-HR")) {
      transactionTemplate.executeWithoutResult(status -> seedAnalyticsOrganization());
    } else if (seedAnalytics) {
      log.info("DataSeeder: analytics org already present (ANALYTICS-DM-HR exists)");
    }
    transactionTemplate.executeWithoutResult(status -> seedFuturePunchesForKnownEmployees());
    log.info("DataSeeder: finished");
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
   * lateness (confirmed weekly schedule Mon–Fri 09:00–17:00 for the study week).
   */
  private void seedFictionalStudyAttendance() {
    Department engineering =
        departmentRepository
            .findByName("Engineering")
            .orElseThrow(() -> new IllegalStateException("Engineering department missing"));
    ZoneId zone = ZoneId.systemDefault();
    LocalDate studyDay = previousWeekday(LocalDate.now(zone));
    User scheduleAuthor =
        userRepository
            .findByEmail("superadmin@puncher.com")
            .orElseThrow(
                () -> new IllegalStateException("superadmin@puncher.com required for study schedules"));

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
        seedShiftWithEvaluation(
            onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0), scheduleAuthor);
        seedShiftWithEvaluation(
            late, studyDay, zone, LocalTime.of(9, 25), LocalTime.of(17, 0), scheduleAuthor);
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
        seedShiftWithEvaluation(
            onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0), scheduleAuthor);
        seedShiftWithEvaluation(
            late, studyDay, zone, LocalTime.of(9, 18), LocalTime.of(17, 0), scheduleAuthor);
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
        seedShiftWithEvaluation(
            onTime, studyDay, zone, LocalTime.of(9, 0), LocalTime.of(17, 0), scheduleAuthor);
        seedShiftWithEvaluation(
            grace, studyDay, zone, LocalTime.of(9, 8), LocalTime.of(17, 0), scheduleAuthor);
        seedShiftWithEvaluation(
            late, studyDay, zone, LocalTime.of(9, 52), LocalTime.of(17, 15), scheduleAuthor);
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

  /**
   * Extra org structure for Power BI: 3 departments, 2 teams each, 4 employees per team (~24
   * employees). All synthetic IDs/emails use the {@code ANALYTICS-} prefix / {@code @analytics.demo}
   * domain. Idempotent via marker {@code ANALYTICS-DM-HR}.
   */
  private void seedAnalyticsOrganization() {
    User scheduleAuthor =
        userRepository
            .findByEmail("superadmin@puncher.com")
            .orElseGet(
                () ->
                    userRepository.findAll().stream()
                        .filter(x -> x.getRole() == UserRole.SUPER_ADMIN)
                        .findFirst()
                        .orElseThrow(
                            () ->
                                new IllegalStateException(
                                    "Super Admin required to seed analytics schedules")));

    log.info("Seeding analytics org (departments, teams, employees) for Power BI");

    record EmployeeSpec(String name, String emailSuffix, String empSuffix) {}

    record TeamSpec(
        String teamName,
        String tlName,
        String tlEmail,
        String tlEmpId,
        EmployeeSpec[] employees) {}

    record DeptSpec(
        String name,
        String description,
        int lateGraceMinutes,
        String dmName,
        String dmEmail,
        String dmEmpId,
        TeamSpec[] teams) {}

    DeptSpec[] departments =
        new DeptSpec[] {
          new DeptSpec(
              "Human Resources",
              "People operations and hiring (analytics demo)",
              10,
              "Hannah Reed",
              "hannah.reed@analytics.demo",
              "ANALYTICS-DM-HR",
              new TeamSpec[] {
                new TeamSpec(
                    "Talent Forge",
                    "Leo Martinez",
                    "leo.talent@analytics.demo",
                    "ANALYTICS-TL-HR-01",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Nina OnTime", "nina.ontime.hr1@analytics.demo", "ANALYTICS-HR1-01"),
                      new EmployeeSpec("Omar Grace", "omar.grace.hr1@analytics.demo", "ANALYTICS-HR1-02"),
                      new EmployeeSpec("Paula Late", "paula.late.hr1@analytics.demo", "ANALYTICS-HR1-03"),
                      new EmployeeSpec("Quinn VeryLate", "quinn.verylate.hr1@analytics.demo", "ANALYTICS-HR1-04")
                    }),
                new TeamSpec(
                    "People Pulse",
                    "Ivy Chen",
                    "ivy.pulse@analytics.demo",
                    "ANALYTICS-TL-HR-02",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Rita OnTime", "rita.ontime.hr2@analytics.demo", "ANALYTICS-HR2-01"),
                      new EmployeeSpec("Sam Grace", "sam.grace.hr2@analytics.demo", "ANALYTICS-HR2-02"),
                      new EmployeeSpec("Tara Late", "tara.late.hr2@analytics.demo", "ANALYTICS-HR2-03"),
                      new EmployeeSpec("Uma VeryLate", "uma.verylate.hr2@analytics.demo", "ANALYTICS-HR2-04")
                    })
              }),
          new DeptSpec(
              "Operations",
              "Facilities and logistics (analytics demo)",
              15,
              "Victor Hale",
              "victor.hale@analytics.demo",
              "ANALYTICS-DM-OPS",
              new TeamSpec[] {
                new TeamSpec(
                    "Logistics Lane",
                    "Wendy Brooks",
                    "wendy.logistics@analytics.demo",
                    "ANALYTICS-TL-OPS-01",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Xander OnTime", "xander.ontime.ops1@analytics.demo", "ANALYTICS-OPS1-01"),
                      new EmployeeSpec("Yara Grace", "yara.grace.ops1@analytics.demo", "ANALYTICS-OPS1-02"),
                      new EmployeeSpec("Zane Late", "zane.late.ops1@analytics.demo", "ANALYTICS-OPS1-03"),
                      new EmployeeSpec("Abby VeryLate", "abby.verylate.ops1@analytics.demo", "ANALYTICS-OPS1-04")
                    }),
                new TeamSpec(
                    "Field Response",
                    "Blake Ortiz",
                    "blake.field@analytics.demo",
                    "ANALYTICS-TL-OPS-02",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Cora OnTime", "cora.ontime.ops2@analytics.demo", "ANALYTICS-OPS2-01"),
                      new EmployeeSpec("Derek Grace", "derek.grace.ops2@analytics.demo", "ANALYTICS-OPS2-02"),
                      new EmployeeSpec("Elena Late", "elena.late.ops2@analytics.demo", "ANALYTICS-OPS2-03"),
                      new EmployeeSpec("Finn VeryLate", "finn.verylate.ops2@analytics.demo", "ANALYTICS-OPS2-04")
                    })
              }),
          new DeptSpec(
              "Sales & Marketing",
              "Revenue and campaigns (analytics demo)",
              5,
              "Gina Porter",
              "gina.porter@analytics.demo",
              "ANALYTICS-DM-SALES",
              new TeamSpec[] {
                new TeamSpec(
                    "Growth Grid",
                    "Henry Vega",
                    "henry.growth@analytics.demo",
                    "ANALYTICS-TL-SALES-01",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Isla OnTime", "isla.ontime.sales1@analytics.demo", "ANALYTICS-SALES1-01"),
                      new EmployeeSpec("Jake Grace", "jake.grace.sales1@analytics.demo", "ANALYTICS-SALES1-02"),
                      new EmployeeSpec("Kira Late", "kira.late.sales1@analytics.demo", "ANALYTICS-SALES1-03"),
                      new EmployeeSpec("Liam VeryLate", "liam.verylate.sales1@analytics.demo", "ANALYTICS-SALES1-04")
                    }),
                new TeamSpec(
                    "Brand Beacon",
                    "Mia Nguyen",
                    "mia.brand@analytics.demo",
                    "ANALYTICS-TL-SALES-02",
                    new EmployeeSpec[] {
                      new EmployeeSpec("Noah OnTime", "noah.ontime.sales2@analytics.demo", "ANALYTICS-SALES2-01"),
                      new EmployeeSpec("Olivia Grace", "olivia.grace.sales2@analytics.demo", "ANALYTICS-SALES2-02"),
                      new EmployeeSpec("Pete Late", "pete.late.sales2@analytics.demo", "ANALYTICS-SALES2-03"),
                      new EmployeeSpec("Quinn VeryLate", "quinn.verylate.sales2@analytics.demo", "ANALYTICS-SALES2-04")
                    })
              })
        };

    int employeeCount = 0;
    for (DeptSpec deptSpec : departments) {
      User deptManager = managerUser(deptSpec.dmName(), deptSpec.dmEmail(), deptSpec.dmEmpId(), UserRole.DEPT_MANAGER);

      Department dept = new Department();
      dept.setName(deptSpec.name());
      dept.setDescription(deptSpec.description());
      dept.setLateGraceMinutes(deptSpec.lateGraceMinutes());
      dept.setAllowedLunchMinutes(30);
      dept.setAllowedBreaksMinutes(30);
      dept.setBusinessFirstStartHour(8);
      dept.setBusinessLastStartHour(10);
      dept.setAdmin(deptManager);
      departmentRepository.save(dept);

      deptManager.setDepartment(dept);
      userRepository.save(deptManager);

      for (TeamSpec teamSpec : deptSpec.teams()) {
        User leader =
            managerUser(teamSpec.tlName(), teamSpec.tlEmail(), teamSpec.tlEmpId(), UserRole.TEAM_LEADER);
        leader.setDepartment(dept);
        userRepository.save(leader);

        Team team = new Team();
        team.setName(teamSpec.teamName());
        team.setDepartment(dept);
        team.setTeamLeader(leader);
        teamRepository.save(team);

        leader.setTeam(team);
        userRepository.save(leader);

        for (EmployeeSpec empSpec : teamSpec.employees()) {
          employee(dept, team, empSpec.name(), empSpec.emailSuffix(), empSpec.empSuffix());
          employeeCount++;
        }
      }
    }

    log.info(
        "Analytics org seeded: 3 departments, 6 teams, {} employees (@analytics.demo / password {})",
        employeeCount,
        DEMO_PW);
    log.info(
        "Power BI filters: departments Human Resources, Operations, Sales & Marketing; employee_id LIKE 'ANALYTICS-%'");
    log.info("DataSeeder: analytics org committed to database");
  }

  private User managerUser(String name, String email, String empId, UserRole role) {
    User u = new User();
    u.setName(name);
    u.setEmail(email);
    u.setPassword(passwordEncoder.encode(DEMO_PW));
    u.setEmployeeId(empId);
    u.setPhoneNumber("+19005550100");
    u.setHiringDate(LocalDate.of(2021, 1, 15));
    u.setStatus(UserStatus.ACTIVE);
    u.setRole(role);
    return userRepository.save(u);
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
   * Minimal valid day: WORK_START + LOGOUT, then attendance evaluation (expects confirmed weekly
   * schedule 09:00–17:00 Mon–Fri for that week).
   */
  private void seedShiftWithEvaluation(
      User employee,
      LocalDate day,
      ZoneId zone,
      LocalTime workStart,
      LocalTime logout,
      User scheduleAuthor) {
    ensureConfirmedStandardWeek(employee, day, scheduleAuthor);
    Instant ws = day.atTime(workStart).atZone(zone).toInstant();
    Instant lo = day.atTime(logout).atZone(zone).toInstant();
    savePunch(employee, ws, PunchType.WORK_START);
    savePunch(employee, lo, PunchType.LOGOUT);
    attendanceService.evaluateAfterLogout(employee, day);
  }

  /** Sun-start week, Mon–Fri 09:00–17:00, weekends off; idempotent if a schedule row exists. */
  private void ensureConfirmedStandardWeek(User employee, LocalDate anyDayInWeek, User createdBy) {
    LocalDate weekStart = ScheduleService.normalizeWeekStart(anyDayInWeek);
    if (weeklyScheduleRepository.findByEmployeeAndWeekFetched(employee.getId(), weekStart).isPresent()) {
      return;
    }
    WeeklySchedule s = new WeeklySchedule();
    s.setEmployee(employee);
    s.setWeekStart(weekStart);
    s.setCreatedBy(createdBy);
    for (int dow = 0; dow <= 6; dow++) {
      WeeklyScheduleDay d = new WeeklyScheduleDay();
      d.setSchedule(s);
      d.setDayOfWeek(dow);
      if (dow == 0 || dow == 6) {
        d.setDayOff(true);
      } else {
        d.setDayOff(false);
        d.setStartTime(LocalTime.of(9, 0));
        d.setEndTime(LocalTime.of(17, 0));
      }
      s.getDays().add(d);
    }
    WeeklySchedule saved = weeklyScheduleRepository.save(s);
    ScheduleConfirmation c = new ScheduleConfirmation();
    c.setSchedule(saved);
    c.setEmployee(employee);
    c.setStatus(ScheduleConfirmationStatus.CONFIRMED);
    c.setRespondedAt(Instant.now());
    scheduleConfirmationRepository.save(c);
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
    List<String> empIds = new java.util.ArrayList<>(
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
            "STUDY-ON-03"));

    userRepository.findAll().stream()
        .filter(u -> u.getRole() == UserRole.EMPLOYEE)
        .map(User::getEmployeeId)
        .filter(id -> id != null && id.startsWith("ANALYTICS-"))
        .filter(id -> !empIds.contains(id))
        .forEach(empIds::add);

    ZoneId zone = ZoneId.systemDefault();
    // Seed the last ~2 months plus a few weeks in the future.
    LocalDate start = LocalDate.now(zone).minusDays(62);
    LocalDate end = LocalDate.now(zone).plusDays(35); // ~5 weeks ahead, weekends skipped

    User scheduleAuthor =
        userRepository
            .findByEmail("superadmin@puncher.com")
            .orElseGet(
                () ->
                    userRepository.findAll().stream()
                        .filter(x -> x.getRole() == UserRole.SUPER_ADMIN)
                        .findFirst()
                        .orElse(null));
    if (scheduleAuthor == null) {
      log.warn("No Super Admin user: demo punches will not get attendance from confirmed schedules");
    }

    int seeded = 0;
    int skipped = 0;
    for (String empId : empIds) {
      Optional<User> opt = userRepository.findByEmployeeId(empId);
      if (opt.isEmpty()) continue;
      User u = opt.get();

      if (scheduleAuthor != null && u.getRole() == UserRole.EMPLOYEE) {
        HashSet<LocalDate> weeks = new HashSet<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
          weeks.add(ScheduleService.normalizeWeekStart(day));
        }
        for (LocalDate ws : weeks) {
          ensureConfirmedStandardWeek(u, ws, scheduleAuthor);
        }
      }

      for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
        if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
          continue;
        }

        if (generateAttendanceRecords
            && u.getRole() == UserRole.EMPLOYEE
            && attendanceRecordRepository.findByUserIdAndRecordDate(u.getId(), day).isPresent()) {
          // Already evaluated for this user/day.
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

        // For analytics (Power BI): persist daily summary into attendance_records too.
        if (generateAttendanceRecords && u.getRole() == UserRole.EMPLOYEE) {
          attendanceService.evaluateAfterLogout(u, day);
        }
        seeded++;
      }
    }

    if (seeded > 0) {
      log.info("Seeded {} future punch-days (skipped {} existing)", seeded, skipped);
    }
  }
}
