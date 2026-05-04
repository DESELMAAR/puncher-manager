package com.punchermanager.repository;

import com.punchermanager.domain.ScheduleConfirmation;
import com.punchermanager.domain.ScheduleConfirmationStatus;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduleConfirmationRepository extends JpaRepository<ScheduleConfirmation, UUID> {

  @Query(
      "select c from ScheduleConfirmation c "
          + "join fetch c.schedule s "
          + "join fetch s.createdBy "
          + "join fetch c.employee "
          + "where s.id = :scheduleId and c.employee.id = :employeeUserId")
  Optional<ScheduleConfirmation> findByScheduleAndEmployeeFetched(
      @Param("scheduleId") UUID scheduleId, @Param("employeeUserId") UUID employeeUserId);

  @Query(
      "select distinct c from ScheduleConfirmation c "
          + "join fetch c.schedule s "
          + "left join fetch s.days "
          + "where c.employee.id = :employeeUserId "
          + "and s.weekStart = :weekStart "
          + "and c.status = :status")
  Optional<ScheduleConfirmation> findByEmployeeWeekAndStatus(
      @Param("employeeUserId") UUID employeeUserId,
      @Param("weekStart") LocalDate weekStart,
      @Param("status") ScheduleConfirmationStatus status);
}

