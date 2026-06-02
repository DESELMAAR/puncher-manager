package com.punchermanager.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.punchermanager.domain.AttendanceRiskRule;
import com.punchermanager.domain.AttendanceStatus;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.AttendanceRecordRepository;
import com.punchermanager.repository.AttendanceRiskAlertRepository;
import com.punchermanager.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AttendanceRiskServiceTest {

  @Mock private UserRepository userRepository;
  @Mock private AttendanceRecordRepository attendanceRecordRepository;
  @Mock private AttendanceRiskAlertRepository attendanceRiskAlertRepository;
  @Mock private NotificationService notificationService;
  @Mock private MailService mailService;

  @InjectMocks private AttendanceRiskService attendanceRiskService;

  private User systemAdmin;
  private User employee;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(attendanceRiskService, "enabled", true);

    systemAdmin = new User();
    systemAdmin.setId(UUID.randomUUID());
    systemAdmin.setEmail("superadmin@puncher.com");
    systemAdmin.setRole(UserRole.SUPER_ADMIN);

    employee = new User();
    employee.setId(UUID.randomUUID());
    employee.setName("Test Employee");
    employee.setEmail("test@example.com");
    employee.setEmployeeId("EMP-TEST");
    employee.setRole(UserRole.EMPLOYEE);
    employee.setStatus(UserStatus.ACTIVE);
  }

  @Test
  void triggersLateWarningWhenThreeLateDaysInSeven() {
    LocalDate asOf = LocalDate.of(2026, 5, 30);
    when(userRepository.findByEmail("superadmin@puncher.com")).thenReturn(Optional.of(systemAdmin));
    when(userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE))
        .thenReturn(List.of(employee));
    when(userRepository.findByIdWithContext(employee.getId())).thenReturn(Optional.of(employee));
    when(attendanceRiskAlertRepository.existsByEmployeeIdAndRuleCodeSince(
            eq(employee.getId()), any(), any()))
        .thenReturn(false);
    when(attendanceRecordRepository.countByUserIdAndStatusAndDateRange(
            eq(employee.getId()), eq(AttendanceStatus.LATE), any(), eq(asOf)))
        .thenReturn(3L);
    when(attendanceRecordRepository.countByUserIdAndStatusAndDateRange(
            eq(employee.getId()), eq(AttendanceStatus.ABSENT), any(), eq(asOf)))
        .thenReturn(0L);

    int created = attendanceRiskService.evaluateAll(asOf);

    verify(notificationService)
        .sendAttendanceRisk(eq(systemAdmin), eq(employee), any(), any());
    verify(attendanceRiskAlertRepository).save(any());
    assertEquals(1, created);
  }

  @Test
  void skipsWhenBelowThreshold() {
    LocalDate asOf = LocalDate.of(2026, 5, 30);
    when(userRepository.findByEmail("superadmin@puncher.com")).thenReturn(Optional.of(systemAdmin));
    when(userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE))
        .thenReturn(List.of(employee));
    when(userRepository.findByIdWithContext(employee.getId())).thenReturn(Optional.of(employee));
    when(attendanceRiskAlertRepository.existsByEmployeeIdAndRuleCodeSince(
            eq(employee.getId()), any(), any()))
        .thenReturn(false);
    when(attendanceRecordRepository.countByUserIdAndStatusAndDateRange(
            eq(employee.getId()), any(), any(), eq(asOf)))
        .thenReturn(1L);

    int created = attendanceRiskService.evaluateAll(asOf);

    assertEquals(0, created);
    verify(notificationService, never()).sendAttendanceRisk(any(), any(), any(), any());
  }

  @Test
  void skipsWhenCooldownActive() {
    LocalDate asOf = LocalDate.of(2026, 5, 30);
    when(userRepository.findByEmail("superadmin@puncher.com")).thenReturn(Optional.of(systemAdmin));
    when(userRepository.findByRoleAndStatus(UserRole.EMPLOYEE, UserStatus.ACTIVE))
        .thenReturn(List.of(employee));
    when(userRepository.findByIdWithContext(employee.getId())).thenReturn(Optional.of(employee));
    when(attendanceRiskAlertRepository.existsByEmployeeIdAndRuleCodeSince(
            eq(employee.getId()), any(), any()))
        .thenReturn(true);

    int created = attendanceRiskService.evaluateAll(asOf);

    assertEquals(0, created);
    verify(notificationService, never()).sendAttendanceRisk(any(), any(), any(), any());
  }
}
