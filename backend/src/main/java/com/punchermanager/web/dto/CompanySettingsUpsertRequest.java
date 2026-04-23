package com.punchermanager.web.dto;

import jakarta.validation.constraints.NotBlank;

public class CompanySettingsUpsertRequest {

  @NotBlank private String companyName;

  @NotBlank private String postalAddress;

  private String departmentLabel;

  private String siteLocation;

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
}

