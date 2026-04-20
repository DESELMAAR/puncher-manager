package com.punchermanager.bootstrap;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import java.time.LocalDate;
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

  private final UserRepository userRepository;
  private final DepartmentRepository departmentRepository;
  private final TeamRepository teamRepository;
  private final PasswordEncoder passwordEncoder;

  public DataSeeder(
      UserRepository userRepository,
      DepartmentRepository departmentRepository,
      TeamRepository teamRepository,
      PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.departmentRepository = departmentRepository;
    this.teamRepository = teamRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (userRepository.findByEmail("superadmin@puncher.com").isPresent()) {
      return;
    }
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
    deptManager.setPassword(passwordEncoder.encode("demo123"));
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
    teamLeader.setPassword(passwordEncoder.encode("demo123"));
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
    employee.setPassword(passwordEncoder.encode("demo123"));
    employee.setEmployeeId("EMP001");
    employee.setPhoneNumber("+1000000004");
    employee.setHiringDate(LocalDate.of(2023, 1, 10));
    employee.setStatus(UserStatus.ACTIVE);
    employee.setRole(UserRole.EMPLOYEE);
    employee.setDepartment(engineering);
    employee.setTeam(alpha);
    userRepository.save(employee);

    log.info(
        "Seeded users: superadmin@puncher.com / admin123; employee@puncher.com / demo123; teamlead@puncher.com / demo123");
  }
}
