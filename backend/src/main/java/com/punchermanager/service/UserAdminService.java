package com.punchermanager.service;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.UserResponse;
import com.punchermanager.web.dto.UserUpsertRequest;
import com.punchermanager.web.exception.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminService {

  private final UserRepository userRepository;
  private final DepartmentRepository departmentRepository;
  private final TeamRepository teamRepository;
  private final PasswordEncoder passwordEncoder;

  public UserAdminService(
      UserRepository userRepository,
      DepartmentRepository departmentRepository,
      TeamRepository teamRepository,
      PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.departmentRepository = departmentRepository;
    this.teamRepository = teamRepository;
    this.passwordEncoder = passwordEncoder;
  }

  private void assertDeptManagerTeamAndDeptInScope(User actor, UserUpsertRequest req) {
    if (actor.getRole() != UserRole.DEPT_MANAGER || actor.getDepartment() == null) {
      return;
    }
    UUID myDept = actor.getDepartment().getId();
    if (req.getDepartmentId() != null && !req.getDepartmentId().equals(myDept)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Outside your department");
    }
    if (req.getTeamId() != null) {
      Team t =
          teamRepository
              .findById(req.getTeamId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Team not found"));
      if (!t.getDepartment().getId().equals(myDept)) {
        throw new ApiException(HttpStatus.FORBIDDEN, "Team not in your department");
      }
    }
  }

  private void assertDeptManagerTargetInOwnDepartment(User actor, User target) {
    if (actor.getRole() != UserRole.DEPT_MANAGER || actor.getDepartment() == null) {
      return;
    }
    if (target.getDepartment() == null
        || !target.getDepartment().getId().equals(actor.getDepartment().getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Outside your department");
    }
  }

  @Transactional(readOnly = true)
  public List<UserResponse> list(User actor) {
    return switch (actor.getRole()) {
      case SUPER_ADMIN, ADMIN -> userRepository.findAll().stream().map(this::toResponse).toList();
      case DEPT_MANAGER -> {
        if (actor.getDepartment() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No department assigned");
        }
        UUID deptId = actor.getDepartment().getId();
        yield userRepository.findAll().stream()
            .filter(u -> u.getDepartment() != null && u.getDepartment().getId().equals(deptId))
            .map(this::toResponse)
            .toList();
      }
      case TEAM_LEADER -> {
        if (actor.getTeam() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No team assigned");
        }
        yield userRepository.findEmployeesByTeamId(actor.getTeam().getId()).stream()
            .map(this::toResponse)
            .toList();
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    };
  }

  @Transactional
  public UserResponse create(User actor, UserUpsertRequest req) {
    if (actor.getRole() == UserRole.TEAM_LEADER) {
      validateTeamLeaderEmployeeUpsert(actor, req);
    } else {
      assertCanManageUser(actor, req.getRole(), resolveDepartmentForAccessCheck(req));
      assertDeptManagerTeamAndDeptInScope(actor, req);
    }
    if (req.getPassword() == null || req.getPassword().isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Password is required");
    }
    if (userRepository.existsByEmail(req.getEmail().trim().toLowerCase())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Email already used");
    }
    if (userRepository.existsByEmployeeId(req.getEmployeeId().trim())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Employee id already used");
    }
    User u = new User();
    applyProfile(u, req);
    u.setPassword(passwordEncoder.encode(req.getPassword()));
    return toResponse(userRepository.save(u));
  }

  @Transactional
  public UserResponse update(User actor, UUID id, UserUpsertRequest req) {
    User existing =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (actor.getRole() == UserRole.TEAM_LEADER) {
      assertTeamLeaderManagesEmployee(actor, existing);
      validateTeamLeaderEmployeeUpsert(actor, req);
    } else {
      assertDeptManagerTargetInOwnDepartment(actor, existing);
      assertCanManageUser(actor, req.getRole(), resolveDepartmentForAccessCheck(req));
      assertDeptManagerTeamAndDeptInScope(actor, req);
    }
    if (!existing.getEmail().equalsIgnoreCase(req.getEmail().trim())
        && userRepository.existsByEmail(req.getEmail().trim().toLowerCase())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Email already used");
    }
    if (!existing.getEmployeeId().equals(req.getEmployeeId().trim())
        && userRepository.existsByEmployeeId(req.getEmployeeId().trim())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Employee id already used");
    }
    applyProfile(existing, req);
    if (req.getPassword() != null && !req.getPassword().isBlank()) {
      existing.setPassword(passwordEncoder.encode(req.getPassword()));
    }
    return toResponse(userRepository.save(existing));
  }

  @Transactional
  public void delete(User actor, UUID id) {
    if (actor.getId().equals(id)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot delete yourself");
    }
    User target =
        userRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (actor.getRole() == UserRole.TEAM_LEADER) {
      assertTeamLeaderManagesEmployee(actor, target);
    } else {
      assertDeptManagerTargetInOwnDepartment(actor, target);
      assertCanManageUser(
          actor,
          target.getRole(),
          target.getDepartment() != null ? target.getDepartment().getId() : null);
    }
    if (!teamRepository.findByTeamLeader_Id(target.getId()).isEmpty()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Cannot delete: this user is the assigned leader of one or more teams. "
              + "Assign a different leader in Teams first.");
    }
    userRepository.delete(target);
  }

  private void validateTeamLeaderEmployeeUpsert(User actor, UserUpsertRequest req) {
    if (actor.getTeam() == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "No team assigned");
    }
    if (req.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Team leaders can only manage employees");
    }
    if (req.getTeamId() == null || !req.getTeamId().equals(actor.getTeam().getId())) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "Employee must be assigned to your team");
    }
  }

  private void assertTeamLeaderManagesEmployee(User actor, User target) {
    if (actor.getTeam() == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "No team assigned");
    }
    if (target.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Can only manage employees on your team");
    }
    if (target.getTeam() == null
        || !target.getTeam().getId().equals(actor.getTeam().getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Employee is not on your team");
    }
  }

  private void assertCanManageUser(User actor, UserRole targetRole, UUID targetDepartmentId) {
    switch (actor.getRole()) {
      case SUPER_ADMIN -> {}
      case ADMIN -> {
        if (targetRole == UserRole.SUPER_ADMIN) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Cannot manage super admin");
        }
      }
      case DEPT_MANAGER -> {
        if (actor.getDepartment() == null) {
          throw new ApiException(HttpStatus.FORBIDDEN, "No department assigned");
        }
        if (targetRole != UserRole.EMPLOYEE && targetRole != UserRole.TEAM_LEADER) {
          throw new ApiException(
              HttpStatus.FORBIDDEN, "Can only manage employees and team leaders");
        }
        if (targetDepartmentId == null
            || !targetDepartmentId.equals(actor.getDepartment().getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Outside your department");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
  }

  /**
   * For department-scoped roles, the department is effectively determined by {@code teamId} when
   * provided (because {@link #applyProfile} sets department from team). This helper makes access
   * checks consistent with that behavior.
   */
  private UUID resolveDepartmentForAccessCheck(UserUpsertRequest req) {
    if (req.getDepartmentId() != null) {
      return req.getDepartmentId();
    }
    if (req.getTeamId() != null) {
      Team t =
          teamRepository
              .findById(req.getTeamId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Team not found"));
      return t.getDepartment().getId();
    }
    return null;
  }

  private void applyProfile(User u, UserUpsertRequest req) {
    u.setName(req.getName());
    u.setEmail(req.getEmail().trim().toLowerCase());
    u.setEmployeeId(req.getEmployeeId().trim());
    u.setPhoneNumber(req.getPhoneNumber());
    u.setHiringDate(req.getHiringDate());
    u.setStatus(req.getStatus());
    u.setRole(req.getRole());
    if (req.getRole() == UserRole.SUPER_ADMIN) {
      u.setDepartment(null);
      u.setTeam(null);
      return;
    }
    if (req.getTeamId() != null) {
      Team team =
          teamRepository
              .findById(req.getTeamId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Team not found"));
      u.setTeam(team);
      u.setDepartment(team.getDepartment());
    } else {
      u.setTeam(null);
      if (req.getDepartmentId() != null) {
        Department d =
            departmentRepository
                .findById(req.getDepartmentId())
                .orElseThrow(
                    () -> new ApiException(HttpStatus.BAD_REQUEST, "Department not found"));
        u.setDepartment(d);
      } else {
        u.setDepartment(null);
      }
    }
    if (req.getRole() == UserRole.EMPLOYEE && u.getTeam() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Employees must be assigned to a team");
    }
    if (req.getRole() == UserRole.TEAM_LEADER && u.getDepartment() == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "Team leaders must be assigned to a department (or a team)");
    }
  }

  private UserResponse toResponse(User u) {
    return new UserResponse(
        u.getId(),
        u.getName(),
        u.getEmail(),
        u.getEmployeeId(),
        u.getPhoneNumber(),
        u.getHiringDate(),
        u.getStatus(),
        u.getRole(),
        u.getDepartment() != null ? u.getDepartment().getId() : null,
        u.getTeam() != null ? u.getTeam().getId() : null);
  }
}
