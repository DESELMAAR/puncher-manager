package com.punchermanager.service;

import com.punchermanager.domain.Department;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.DepartmentRepository;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.dto.DepartmentRequest;
import com.punchermanager.web.dto.DepartmentResponse;
import com.punchermanager.web.exception.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepartmentService {

  private final DepartmentRepository departmentRepository;
  private final UserRepository userRepository;

  public DepartmentService(
      DepartmentRepository departmentRepository, UserRepository userRepository) {
    this.departmentRepository = departmentRepository;
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public List<DepartmentResponse> listAll() {
    return departmentRepository.findAll().stream().map(this::toResponse).toList();
  }

  @Transactional
  public DepartmentResponse create(DepartmentRequest req) {
    Department d = new Department();
    d.setName(req.getName());
    d.setDescription(req.getDescription());
    if (req.getAdminId() != null) {
      User admin =
          userRepository
              .findById(req.getAdminId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Admin user not found"));
      if (admin.getRole() != UserRole.DEPT_MANAGER) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Department admin must be DEPT_MANAGER");
      }
      d.setAdmin(admin);
    }
    Department saved = departmentRepository.save(d);
    if (saved.getAdmin() != null) {
      User a = saved.getAdmin();
      a.setDepartment(saved);
      userRepository.save(a);
    }
    return toResponse(saved);
  }

  @Transactional
  public DepartmentResponse update(UUID id, DepartmentRequest req) {
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Department not found"));
    d.setName(req.getName());
    d.setDescription(req.getDescription());
    if (req.getAdminId() != null) {
      User admin =
          userRepository
              .findById(req.getAdminId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Admin user not found"));
      if (admin.getRole() != UserRole.DEPT_MANAGER) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Department admin must be DEPT_MANAGER");
      }
      d.setAdmin(admin);
      admin.setDepartment(d);
      userRepository.save(admin);
    }
    return toResponse(departmentRepository.save(d));
  }

  @Transactional
  public void delete(UUID id) {
    if (!departmentRepository.existsById(id)) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Department not found");
    }
    departmentRepository.deleteById(id);
  }

  private DepartmentResponse toResponse(Department d) {
    return new DepartmentResponse(
        d.getId(),
        d.getName(),
        d.getDescription(),
        d.getCreatedAt(),
        d.getAdmin() != null ? d.getAdmin().getId() : null);
  }
}
