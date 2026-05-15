package com.punchermanager.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.AttendanceRecordRepository;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.PunchRepository;
import com.punchermanager.repository.TeamRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.AttendanceAnalyticsResponseDto;
import com.punchermanager.web.exception.ApiException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceAnalyticsTest {

  @Mock private AttendanceRecordRepository attendanceRecordRepository;
  @Mock private PlanningService planningService;
  @Mock private PunchRepository punchRepository;
  @Mock private UserRepository userRepository;
  @Mock private TeamRepository teamRepository;
  @Mock private DepartmentRepository departmentRepository;

  @InjectMocks private AttendanceService attendanceService;

  private User admin;
  private ZoneId zone;

  @BeforeEach
  void setUp() {
    zone = ZoneId.of("UTC");
    admin = new User();
    admin.setId(UUID.randomUUID());
    admin.setRole(UserRole.ADMIN);
    admin.setStatus(UserStatus.ACTIVE);
    admin.setEmail("admin@test.local");
    admin.setName("Admin");
    admin.setEmployeeId("ADM001");
    admin.setPassword("x");
  }

  @Test
  void analytics_rejectsRangeOver62Days() {
    LocalDate from = LocalDate.of(2026, 1, 1);
    LocalDate to = LocalDate.of(2026, 4, 1);

    assertThatThrownBy(
            () -> attendanceService.analytics(from, to, null, null, null, admin, zone))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException api = (ApiException) ex;
              assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(api.getMessage()).contains("Range too large");
            });
  }

  @Test
  void analytics_rejectsNullDates() {
    assertThatThrownBy(
            () ->
                attendanceService.analytics(
                    null, LocalDate.now(), null, null, null, admin, zone))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).getMessage()).contains("from and to are required"));
  }

  @Test
  void analytics_returnsEmptyTotalsWhenNoEmployees() {
    when(userRepository.findAll()).thenReturn(List.of());

    LocalDate from = LocalDate.of(2026, 5, 1);
    LocalDate to = LocalDate.of(2026, 5, 7);

    AttendanceAnalyticsResponseDto res =
        attendanceService.analytics(from, to, null, null, null, admin, zone);

    assertThat(res.totalRecords()).isZero();
    assertThat(res.presentCount()).isZero();
    assertThat(res.lateCount()).isZero();
    assertThat(res.absentCount()).isZero();
    assertThat(res.daily()).hasSize(7);
  }
}
