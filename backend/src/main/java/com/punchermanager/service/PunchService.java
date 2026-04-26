package com.punchermanager.service;

import com.punchermanager.domain.Punch;
import com.punchermanager.domain.PunchType;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.PunchRepository;
import com.punchermanager.web.dto.PunchRequest;
import com.punchermanager.web.dto.PunchResponse;
import com.punchermanager.web.exception.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PunchService {

  private static final List<PunchType> SEQUENCE =
      Arrays.asList(
          PunchType.WORK_START,
          PunchType.BREAK1_START,
          PunchType.BREAK1_END,
          PunchType.LUNCH_START,
          PunchType.LUNCH_END,
          PunchType.BREAK2_START,
          PunchType.BREAK2_END,
          PunchType.LOGOUT);

  private final PunchRepository punchRepository;
  private final AttendanceService attendanceService;

  public PunchService(PunchRepository punchRepository, AttendanceService attendanceService) {
    this.punchRepository = punchRepository;
    this.attendanceService = attendanceService;
  }

  /**
   * Uses the browser's IANA zone ({@code X-Client-Timezone}) so punch-day and sequence validation match
   * {@code GET /my-history} civil dates in that zone.
   */
  public static ZoneId resolveClientZone(String headerValue) {
    if (headerValue == null || headerValue.isBlank()) {
      return ZoneId.systemDefault();
    }
    try {
      return ZoneId.of(headerValue.trim());
    } catch (Exception e) {
      return ZoneId.systemDefault();
    }
  }

  @Transactional
  public PunchResponse punch(User user, PunchRequest request, ZoneId zone) {
    if (user.getRole() != UserRole.EMPLOYEE) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only employees can punch");
    }
    Instant when = request.getTimestamp() != null ? request.getTimestamp() : Instant.now();
    // Compute the "attendance day" in the SAME timezone as the UI calendar day.
    LocalDate day = LocalDate.ofInstant(when, zone);

    // Build a day window [00:00, next day 00:00) in the same zone for consistent sequencing.
    List<Punch> dayPunches =
        punchRepository.findByUserAndRange(
            user.getId(),
            day.atStartOfDay(zone).toInstant(),
            day.plusDays(1).atStartOfDay(zone).toInstant());

    PunchType expected = resolveExpectedNext(dayPunches);
    // Allow employees to switch back to "on work" at any time.
    if (request.getType() != PunchType.WORK_START && request.getType() != expected) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Cannot register "
              + request.getType()
              + ". Next expected punch is "
              + expected
              + ".");
    }

    Punch p = new Punch();
    p.setUser(user);
    p.setPunchType(request.getType());
    p.setPunchedAt(when);
    Punch saved = punchRepository.save(p);

    if (request.getType() == PunchType.LOGOUT) {
      attendanceService.evaluateAfterLogout(user, day);
    }

    return new PunchResponse(saved.getId(), saved.getPunchType(), saved.getPunchedAt());
  }

  private PunchType resolveExpectedNext(List<Punch> dayPunchesOrdered) {
    if (dayPunchesOrdered.isEmpty()) {
      return PunchType.WORK_START;
    }
    PunchType last = dayPunchesOrdered.get(dayPunchesOrdered.size() - 1).getPunchType();
    if (last == PunchType.LOGOUT) {
      // Allow restarting a new work cycle after ending a shift.
      return PunchType.WORK_START;
    }
    int idx = SEQUENCE.indexOf(last);
    if (idx < 0 || idx >= SEQUENCE.size() - 1) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid punch sequence state");
    }
    return SEQUENCE.get(idx + 1);
  }

  @Transactional(readOnly = true)
  public List<PunchResponse> myHistory(User user, LocalDate from, LocalDate to, ZoneId zone) {
    Instant start = from.atStartOfDay(zone).toInstant();
    Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();
    return punchRepository.findByUserAndRange(user.getId(), start, end).stream()
        .map(p -> new PunchResponse(p.getId(), p.getPunchType(), p.getPunchedAt()))
        .toList();
  }
}
