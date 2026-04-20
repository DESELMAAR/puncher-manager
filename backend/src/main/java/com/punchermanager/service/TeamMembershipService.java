package com.punchermanager.service;

import com.punchermanager.domain.Team;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.exception.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamMembershipService {

  private final TeamRepository teamRepository;
  private final UserRepository userRepository;

  public TeamMembershipService(TeamRepository teamRepository, UserRepository userRepository) {
    this.teamRepository = teamRepository;
    this.userRepository = userRepository;
  }

  @Transactional
  public void addEmployee(User actor, UUID teamId, UUID employeeUserId) {
    Team team =
        teamRepository
            .findByIdFetched(teamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    if (actor.getRole() != UserRole.TEAM_LEADER
        || !team.getTeamLeader().getId().equals(actor.getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only the team leader can add members");
    }
    User emp =
        userRepository
            .findByIdWithContext(employeeUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (emp.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Only employees can join a team roster");
    }
    if (emp.getDepartment() == null
        || !team.getDepartment().getId().equals(emp.getDepartment().getId())) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "Employee must belong to the same department as the team");
    }
    emp.setTeam(team);
    userRepository.save(emp);
  }

  @Transactional
  public void removeEmployee(User actor, UUID teamId, UUID employeeUserId) {
    Team team =
        teamRepository
            .findByIdFetched(teamId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Team not found"));
    if (actor.getRole() != UserRole.TEAM_LEADER
        || !team.getTeamLeader().getId().equals(actor.getId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only the team leader can remove members");
    }
    User emp =
        userRepository
            .findById(employeeUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    if (emp.getTeam() == null || !emp.getTeam().getId().equals(teamId)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "User is not in this team");
    }
    emp.setTeam(null);
    userRepository.save(emp);
  }
}
