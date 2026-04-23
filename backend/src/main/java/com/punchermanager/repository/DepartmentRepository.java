package com.punchermanager.repository;

import com.punchermanager.domain.Department;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {

  Optional<Department> findByName(String name);
}
