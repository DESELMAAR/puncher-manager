package com.punchermanager.repository;

import com.punchermanager.domain.AttendanceRiskAlert;
import com.punchermanager.domain.AttendanceRiskRule;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRiskAlertRepository extends JpaRepository<AttendanceRiskAlert, UUID> {

  @Query(
      "select count(a) > 0 from AttendanceRiskAlert a where a.employee.id = :employeeId "
          + "and a.ruleCode = :ruleCode and a.createdAt >= :since")
  boolean existsByEmployeeIdAndRuleCodeSince(
      @Param("employeeId") UUID employeeId,
      @Param("ruleCode") AttendanceRiskRule ruleCode,
      @Param("since") Instant since);
}
