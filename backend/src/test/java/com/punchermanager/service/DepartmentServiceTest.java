package com.punchermanager.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.domain.UserStatus;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.DepartmentRequest;
import com.punchermanager.web.exception.ApiException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class DepartmentServiceTest {

  @Mock private DepartmentRepository departmentRepository;
  @Mock private UserRepository userRepository;

  @InjectMocks private DepartmentService departmentService;

  @Test
  void create_rejectsAdminWhoIsNotDeptManager() {
    UUID adminId = UUID.randomUUID();
    User employee = new User();
    employee.setId(adminId);
    employee.setRole(UserRole.EMPLOYEE);
    employee.setStatus(UserStatus.ACTIVE);
    employee.setEmail("emp@test.local");
    employee.setName("Emp");
    employee.setEmployeeId("E1");
    employee.setPassword("x");

    when(userRepository.findById(adminId)).thenReturn(Optional.of(employee));

    DepartmentRequest req = new DepartmentRequest();
    req.setName("Engineering");
    req.setAdminId(adminId);

    assertThatThrownBy(() -> departmentService.create(req))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> {
              ApiException api = (ApiException) ex;
              assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
              assertThat(api.getMessage()).contains("DEPT_MANAGER");
            });

    verify(departmentRepository, never()).save(any());
  }
}
