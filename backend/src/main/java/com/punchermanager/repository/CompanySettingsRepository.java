package com.punchermanager.repository;

import com.punchermanager.domain.CompanySettings;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CompanySettingsRepository extends JpaRepository<CompanySettings, UUID> {

  @Query("select c from CompanySettings c order by c.updatedAt desc")
  java.util.List<CompanySettings> findLatest();
}

