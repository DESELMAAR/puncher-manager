package com.punchermanager.repository;

import com.punchermanager.domain.ScheduleConfirmation;
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
}

