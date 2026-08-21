package com.healthvault.auth.controller;

import com.healthvault.auth.dto.UserResponse;
import com.healthvault.auth.entity.User;
import com.healthvault.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /** Returns the profile of the currently authenticated user. Requires a valid JWT. */
    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName());
    }
}
