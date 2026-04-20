package com.punchermanager.service;

import com.punchermanager.domain.User;
import com.punchermanager.repository.UserRepository;
import com.punchermanager.web.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class UserContextService {

  private final UserRepository userRepository;

  public UserContextService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  public User requireCurrentUser(HttpServletRequest request) {
    Object raw = request.getAttribute("jwtUserId");
    if (!(raw instanceof UUID)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing authentication");
    }
    return userRepository
        .findByIdWithContext((UUID) raw)
        .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));
  }
}
