package com.punchermanager.repository;

import com.punchermanager.domain.Team;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamRepository extends JpaRepository<Team, UUID> {

  List<Team> findByDepartmentId(UUID departmentId);

  List<Team> findByTeamLeader_Id(UUID teamLeaderUserId);

  @Query(
      "select t from Team t join fetch t.teamLeader join fetch t.department where t.id = :id")
  Optional<Team> findByIdFetched(@Param("id") UUID id);
}
