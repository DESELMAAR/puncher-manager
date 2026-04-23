package com.punchermanager.service;

import com.punchermanager.domain.CompanySettings;
import com.punchermanager.domain.User;
import com.punchermanager.domain.UserRole;
import com.punchermanager.repository.CompanySettingsRepository;
import com.punchermanager.web.dto.CompanySettingsDto;
import com.punchermanager.web.dto.CompanySettingsUpsertRequest;
import com.punchermanager.web.exception.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanySettingsService {

  private final CompanySettingsRepository repo;

  public CompanySettingsService(CompanySettingsRepository repo) {
    this.repo = repo;
  }

  @Transactional(readOnly = true)
  public CompanySettingsDto get() {
    CompanySettings s = repo.findLatest().stream().findFirst().orElse(null);
    if (s == null) {
      return new CompanySettingsDto(null, null, null, null, null, null);
    }
    return toDto(s);
  }

  @Transactional
  public CompanySettingsDto upsert(User actor, CompanySettingsUpsertRequest req) {
    if (actor.getRole() != UserRole.SUPER_ADMIN) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only super admin can manage settings");
    }
    CompanySettings current = repo.findLatest().stream().findFirst().orElse(null);
    CompanySettings s = current != null ? current : new CompanySettings();
    s.setCompanyName(req.getCompanyName().trim());
    s.setPostalAddress(req.getPostalAddress().trim());
    s.setDepartmentLabel(req.getDepartmentLabel() != null && !req.getDepartmentLabel().isBlank()
        ? req.getDepartmentLabel().trim()
        : null);
    s.setSiteLocation(req.getSiteLocation() != null && !req.getSiteLocation().isBlank()
        ? req.getSiteLocation().trim()
        : null);
    CompanySettings saved = repo.save(s);
    return toDto(saved);
  }

  @Transactional
  public void delete(User actor) {
    if (actor.getRole() != UserRole.SUPER_ADMIN) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Only super admin can manage settings");
    }
    // Remove all rows (keep simple; settings is effectively singleton).
    repo.deleteAllInBatch();
  }

  private static CompanySettingsDto toDto(CompanySettings s) {
    UUID id = s.getId();
    return new CompanySettingsDto(
        id,
        s.getCompanyName(),
        s.getPostalAddress(),
        s.getDepartmentLabel(),
        s.getSiteLocation(),
        s.getUpdatedAt());
  }
}

