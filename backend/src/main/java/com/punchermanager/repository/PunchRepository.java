package com.punchermanager.repository;

import com.punchermanager.domain.Punch;
import com.punchermanager.domain.PunchType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PunchRepository extends JpaRepository<Punch, UUID> {

  @Query(
      "select p from Punch p where p.user.id = :userId and p.punchedAt >= :from and p.punchedAt < :to order by p.punchedAt asc")
  List<Punch> findByUserAndRange(
      @Param("userId") UUID userId,
      @Param("from") Instant from,
      @Param("to") Instant to);

  @Query(
      "select p from Punch p where p.user.id = :userId and p.punchedAt >= :from and p.punchedAt < :to order by p.punchedAt desc")
  List<Punch> findByUserAndRangeDesc(
      @Param("userId") UUID userId,
      @Param("from") Instant from,
      @Param("to") Instant to);

  Optional<Punch> findFirstByUserIdAndPunchTypeAndPunchedAtBetween(
      UUID userId, PunchType punchType, Instant from, Instant to);

  @Query(
      "select p from Punch p join fetch p.user u where u.id in :userIds and p.punchedAt >= :from and p.punchedAt < :to order by p.punchedAt asc")
  List<Punch> findByUsersAndRange(
      @Param("userIds") List<UUID> userIds,
      @Param("from") Instant from,
      @Param("to") Instant to);
}
