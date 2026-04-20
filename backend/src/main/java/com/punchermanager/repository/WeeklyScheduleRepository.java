package com.punchermanager.repository;

import com.punchermanager.domain.WeeklySchedule;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WeeklyScheduleRepository extends JpaRepository<WeeklySchedule, UUID> {

  @Query(
      "select s from WeeklySchedule s "
          + "join fetch s.employee "
          + "join fetch s.createdBy "
          + "left join fetch s.days "
          + "where s.id = :id")
  Optional<WeeklySchedule> findByIdFetched(@Param("id") UUID id);

  @Query(
      "select s from WeeklySchedule s "
          + "join fetch s.employee "
          + "join fetch s.createdBy "
          + "left join fetch s.days "
          + "where s.employee.id = :employeeUserId and s.weekStart = :weekStart")
  Optional<WeeklySchedule> findByEmployeeAndWeekFetched(
      @Param("employeeUserId") UUID employeeUserId, @Param("weekStart") LocalDate weekStart);
}

