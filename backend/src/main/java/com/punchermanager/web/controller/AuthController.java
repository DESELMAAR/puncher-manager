package com.punchermanager.web.controller;

import com.punchermanager.domain.User;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.service.JwtService;
import com.punchermanager.web.dto.LoginRequest;
import com.punchermanager.web.dto.LoginResponse;
import com.punchermanager.web.exception.ApiException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthController(
      UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
  }

  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest req) {
    User user =
        userRepository
            .findByEmail(req.getEmail().trim().toLowerCase())
            .orElseThrow(
                () -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
    if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
    String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
    return new LoginResponse(
        token,
        user.getId(),
        user.getName(),
        user.getEmail(),
        user.getRole(),
        user.getEmployeeId(),
        user.getDepartment() != null ? user.getDepartment().getId() : null,
        user.getTeam() != null ? user.getTeam().getId() : null);
  }
}
