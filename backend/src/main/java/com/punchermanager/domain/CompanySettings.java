package com.punchermanager.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "company_settings")
public class CompanySettings {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "company_name")
  private String companyName;

  @Column(name = "postal_address", columnDefinition = "TEXT")
  private String postalAddress;

  /** Optional label for the department/branch (not the HR department entity). */
  @Column(name = "department_label")
  private String departmentLabel;

  @Column(name = "site_location")
  private String siteLocation;

  /** Public URL to a logo image displayed in the top header. */
  @Column(name = "logo_url", columnDefinition = "TEXT")
  private String logoUrl;

  /** Public URL to a background image used behind the company header. */
  @Column(name = "background_image_url", columnDefinition = "TEXT")
  private String backgroundImageUrl;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getCompanyName() {
    return companyName;
  }

  public void setCompanyName(String companyName) {
    this.companyName = companyName;
  }

  public String getPostalAddress() {
    return postalAddress;
  }

  public void setPostalAddress(String postalAddress) {
    this.postalAddress = postalAddress;
  }

  public String getDepartmentLabel() {
    return departmentLabel;
  }

  public void setDepartmentLabel(String departmentLabel) {
    this.departmentLabel = departmentLabel;
  }

  public String getSiteLocation() {
    return siteLocation;
  }

  public void setSiteLocation(String siteLocation) {
    this.siteLocation = siteLocation;
  }

  public String getLogoUrl() {
    return logoUrl;
  }

  public void setLogoUrl(String logoUrl) {
    this.logoUrl = logoUrl;
  }

  public String getBackgroundImageUrl() {
    return backgroundImageUrl;
  }

  public void setBackgroundImageUrl(String backgroundImageUrl) {
    this.backgroundImageUrl = backgroundImageUrl;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}

