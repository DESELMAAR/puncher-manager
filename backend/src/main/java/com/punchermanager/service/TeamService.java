package com.punchermanager.service;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.TeamRequest;
import com.punchermanager.web.dto.TeamResponse;
import com.punchermanager.web.exception.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamService {

  private final TeamRepository teamRepository;
  private final DepartmentRepository departmentRepository;
  private final UserRepository userRepository;

  public TeamService(
      TeamRepository teamRepository,
      DepartmentRepository departmentRepository,
      UserRepository userRepository) {
    this.teamRepository = teamRepository;
    this.departmentRepository = departmentRepository;
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public List<TeamResponse> listByDepartment(User actor, UUID departmentId) {
    assertDepartmentAccess(actor, departmentId);
    return teamRepository.findByDepartmentId(departmentId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public TeamResponse create(User actor, TeamRequest req) {
    assertDepartmentAccess(actor, req.getDepartmentId());
    Department dept =
        departmentRepository
            .findById(req.getDepartmentId())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Department not found"));
    User leader =
        userRepository
            .findById(req.getTeamLeaderId())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Team leader not found"));
    if (leader.getRole() != UserRole.TEAM_LEADER) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "User must have TEAM_LEADER role");
    }
    Team t = new Team();
    t.setName(req.getName());
    t.setDepartment(dept);
    t.setTeamLeader(leader);
    Team saved = teamRepository.save(t);
    leader.setDepartment(dept);
    leader.setTeam(saved);
    userRepository.save(leader);
    return toResponse(saved);
  }

  @Transactional
  public TeamResponse update(User actor, UUID id, TeamRequest req) {
    Team t =
        teamRepository
            .findByIdFetched(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    assertDepartmentAccess(actor, t.getDepartment().getId());
    assertDepartmentAccess(actor, req.getDepartmentId());
    Department dept =
        departmentRepository
            .findById(req.getDepartmentId())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Department not found"));
    User leader =
        userRepository
            .findById(req.getTeamLeaderId())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Team leader not found"));
    if (leader.getRole() != UserRole.TEAM_LEADER) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "User must have TEAM_LEADER role");
    }
    t.setName(req.getName());
    t.setDepartment(dept);
    t.setTeamLeader(leader);
    leader.setDepartment(dept);
    leader.setTeam(t);
    userRepository.save(leader);
    return toResponse(teamRepository.save(t));
  }

  @Transactional
  public void delete(User actor, UUID id) {
    Team t =
        teamRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    assertDepartmentAccess(actor, t.getDepartment().getId());
    User leader = t.getTeamLeader();
    if (leader != null && leader.getTeam() != null && leader.getTeam().getId().equals(id)) {
      leader.setTeam(null);
      userRepository.save(leader);
    }
    teamRepository.delete(t);
  }

  private void assertDepartmentAccess(User actor, UUID departmentId) {
    switch (actor.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case DEPT_MANAGER -> {
        if (actor.getDepartment() == null
            || !actor.getDepartment().getId().equals(departmentId)) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Outside your department");
        }
      }
      case TEAM_LEADER -> {
        if (actor.getTeam() == null
            || !actor.getTeam().getDepartment().getId().equals(departmentId)) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Outside your team scope");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }
  }

  private TeamResponse toResponse(Team t) {
    return new TeamResponse(
        t.getId(), t.getName(), t.getDepartment().getId(), t.getTeamLeader().getId());
  }
}
