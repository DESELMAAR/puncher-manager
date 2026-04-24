package com.punchermanager.repository;

import com.punchermanager.domain.AttendanceRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, UUID> {

  Optional<AttendanceRecord> findByUserIdAndRecordDate(UUID userId, LocalDate recordDate);

  @Query(
      "select a from AttendanceRecord a where a.user.id in :userIds and a.recordDate = :date")
  List<AttendanceRecord> findByUserIdsAndDate(
      @Param("userIds") List<UUID> userIds, @Param("date") LocalDate date);

  @Query(
      "select a from AttendanceRecord a where a.user.id in :userIds and a.recordDate >= :from and a.recordDate <= :to")
  List<AttendanceRecord> findByUserIdsAndDateRange(
      @Param("userIds") List<UUID> userIds,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to);
}
