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
    d.setBusinessFirstStartHour(req.getBusinessFirstStartHour());
    d.setBusinessLastStartHour(req.getBusinessLastStartHour());
    d.setLateGraceMinutes(req.getLateGraceMinutes());
    d.setAllowedLunchMinutes(req.getAllowedLunchMinutes());
    d.setAllowedBreaksMinutes(req.getAllowedBreaksMinutes());
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
      if (a.getDepartment() == null) {
        a.setDepartment(saved);
      }
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
    d.setBusinessFirstStartHour(req.getBusinessFirstStartHour());
    d.setBusinessLastStartHour(req.getBusinessLastStartHour());
    d.setLateGraceMinutes(req.getLateGraceMinutes());
    d.setAllowedLunchMinutes(req.getAllowedLunchMinutes());
    d.setAllowedBreaksMinutes(req.getAllowedBreaksMinutes());
    if (req.getAdminId() != null) {
      User admin =
          userRepository
              .findById(req.getAdminId())
              .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Admin user not found"));
      if (admin.getRole() != UserRole.DEPT_MANAGER) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Department admin must be DEPT_MANAGER");
      }
      d.setAdmin(admin);
      if (admin.getDepartment() == null) {
        admin.setDepartment(d);
      }
      userRepository.save(admin);
    } else {
      d.setAdmin(null);
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
        d.getAdmin() != null ? d.getAdmin().getId() : null,
        d.getBusinessFirstStartHour(),
        d.getBusinessLastStartHour(),
        d.getLateGraceMinutes(),
        d.getAllowedLunchMinutes(),
        d.getAllowedBreaksMinutes());
  }

  @Transactional
  public DepartmentResponse updateAllowedDurations(
      UUID id, Integer allowedLunchMinutes, Integer allowedBreaksMinutes, User requester) {
    if (allowedLunchMinutes != null && (allowedLunchMinutes < 0 || allowedLunchMinutes > 300)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "Allowed lunch minutes must be between 0 and 300");
    }
    if (allowedBreaksMinutes != null && (allowedBreaksMinutes < 0 || allowedBreaksMinutes > 300)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "Allowed breaks minutes must be between 0 and 300");
    }
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Department not found"));

    switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case DEPT_MANAGER -> {
        if (requester.getDepartment() == null
            || !requester.getDepartment().getId().equals(d.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not your department");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }

    d.setAllowedLunchMinutes(allowedLunchMinutes);
    d.setAllowedBreaksMinutes(allowedBreaksMinutes);
    return toResponse(departmentRepository.save(d));
  }

  @Transactional
  public DepartmentResponse updateLateGraceMinutes(UUID id, Integer minutes, User requester) {
    if (minutes != null && (minutes < 0 || minutes > 120)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Grace minutes must be between 0 and 120");
    }
    Department d =
        departmentRepository
            .findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Department not found"));

    switch (requester.getRole()) {
      case SUPER_ADMIN, ADMIN -> {}
      case DEPT_MANAGER -> {
        if (requester.getDepartment() == null
            || !requester.getDepartment().getId().equals(d.getId())) {
          throw new ApiException(HttpStatus.FORBIDDEN, "Not your department");
        }
      }
      default -> throw new ApiException(HttpStatus.FORBIDDEN, "Insufficient role");
    }

    d.setLateGraceMinutes(minutes);
    return toResponse(departmentRepository.save(d));
  }
}
