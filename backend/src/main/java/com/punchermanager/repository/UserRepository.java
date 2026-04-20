package com.punchermanager.repository;

import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

  @EntityGraph(attributePaths = {"team", "department"})
  @Query("select u from User u where u.id = :id")
  Optional<User> findByIdWithContext(@Param("id") UUID id);

  @EntityGraph(attributePaths = {"team", "department"})
  Optional<User> findByEmail(String email);

  boolean existsByEmail(String email);

  boolean existsByEmployeeId(String employeeId);

  @EntityGraph(attributePaths = {"team", "department"})
  Optional<User> findByEmployeeId(String employeeId);

  List<User> findByTeamId(UUID teamId);

  List<User> findByDepartmentIdAndRole(UUID departmentId, UserRole role);

  @Query(
      "select u from User u where u.role = :role and u.status = :status")
  List<User> findByRoleAndStatus(
      @Param("role") UserRole role, @Param("status") UserStatus status);

  @Query(
      "select u from User u join fetch u.team t where t.id = :teamId and u.role = 'EMPLOYEE'")
  List<User> findEmployeesByTeamId(@Param("teamId") UUID teamId);
}
