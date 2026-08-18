package com.healthvault.auth.service;

import com.healthvault.auth.config.JwtProperties;
import com.healthvault.auth.dto.*;
import com.healthvault.auth.entity.RefreshToken;
import com.healthvault.auth.entity.User;
import com.healthvault.auth.repository.RefreshTokenRepository;
import com.healthvault.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private TokenService tokenService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtProperties jwtProperties;

    @InjectMocks private AuthService authService;

    // ---- register -------------------------------------------------------

    @Test
    void register_newEmail_saves_user_and_returns_public_response() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Str0ngPass")).thenReturn("$2a$10$hashed");

        User saved = User.builder()
                .id(UUID.randomUUID())
                .email("alice@example.com")
                .fullName("Alice")
                .passwordHash("$2a$10$hashed")
                .build();
        when(userRepository.save(any())).thenReturn(saved);

        UserResponse result = authService.register(new RegisterRequest("alice@example.com", "Str0ngPass", "Alice"));

        assertThat(result.email()).isEqualTo("alice@example.com");
        assertThat(result.fullName()).isEqualTo("Alice");
        assertThat(result.id()).isEqualTo(saved.getId());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_existingEmail_throws_409_conflict() {
        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() ->
                authService.register(new RegisterRequest("dup@example.com", "anypass1", "Dup")))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                    .isEqualTo(HttpStatus.CONFLICT));

        verify(userRepository, never()).save(any());
    }

    // ---- login ----------------------------------------------------------

    @Test
    void login_validCredentials_returns_accessToken_and_refreshToken() {
        User user = buildUser();
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pass", user.getPasswordHash())).thenReturn(true);
        when(tokenService.generateAccessToken(user.getId(), user.getEmail())).thenReturn("access.jwt");
        when(tokenService.generateRefreshTokenRaw()).thenReturn("raw-refresh");
        when(tokenService.hashToken("raw-refresh")).thenReturn("hashed-refresh");
        when(refreshTokenRepository.save(any())).thenReturn(new RefreshToken());
        when(jwtProperties.accessTokenTtlMinutes()).thenReturn(15L);
        when(jwtProperties.refreshTokenTtlDays()).thenReturn(30L);

        AuthResponse result = authService.login(new LoginRequest("alice@example.com", "pass"));

        assertThat(result.accessToken()).isEqualTo("access.jwt");
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        assertThat(result.expiresIn()).isEqualTo(900L);   // 15 * 60
    }

    @Test
    void login_wrongPassword_throws_401() {
        User user = buildUser();
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", user.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("alice@example.com", "wrong")))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void login_unknownEmail_throws_401() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@example.com", "pass")))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    // ---- refresh --------------------------------------------------------

    @Test
    void refresh_validToken_revokesOld_and_returns_new_pair() {
        User user = buildUser();
        RefreshToken stored = RefreshToken.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tokenHash("stored-hash")
                .expiresAt(OffsetDateTime.now().plusDays(10))
                .revoked(false)
                .build();

        when(tokenService.hashToken("raw-old")).thenReturn("stored-hash");
        when(refreshTokenRepository.findByTokenHash("stored-hash")).thenReturn(Optional.of(stored));
        when(refreshTokenRepository.save(any())).thenReturn(stored);   // save revoked + save new
        when(tokenService.generateAccessToken(user.getId(), user.getEmail())).thenReturn("new.access.jwt");
        when(tokenService.generateRefreshTokenRaw()).thenReturn("new-raw-refresh");
        when(tokenService.hashToken("new-raw-refresh")).thenReturn("new-hashed");
        when(jwtProperties.accessTokenTtlMinutes()).thenReturn(15L);
        when(jwtProperties.refreshTokenTtlDays()).thenReturn(30L);

        AuthResponse result = authService.refresh("raw-old");

        assertThat(result.accessToken()).isEqualTo("new.access.jwt");
        assertThat(result.refreshToken()).isEqualTo("new-raw-refresh");
        assertThat(stored.isRevoked()).isTrue();   // old token was rotated out
    }

    @Test
    void refresh_revokedToken_throws_401() {
        RefreshToken revoked = RefreshToken.builder()
                .tokenHash("hash")
                .expiresAt(OffsetDateTime.now().plusDays(1))
                .revoked(true)
                .build();

        when(tokenService.hashToken("raw")).thenReturn("hash");
        when(refreshTokenRepository.findByTokenHash("hash")).thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> authService.refresh("raw"))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void refresh_expiredToken_throws_401() {
        RefreshToken expired = RefreshToken.builder()
                .tokenHash("hash")
                .expiresAt(OffsetDateTime.now().minusDays(1))   // past
                .revoked(false)
                .build();

        when(tokenService.hashToken("raw")).thenReturn("hash");
        when(refreshTokenRepository.findByTokenHash("hash")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> authService.refresh("raw"))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    // ---- logout ---------------------------------------------------------

    @Test
    void logout_blacklists_access_token_and_revokes_refresh_token() {
        Jwt mockJwt = mock(Jwt.class);
        when(tokenService.decode("access.token")).thenReturn(mockJwt);
        doNothing().when(tokenService).blacklist(mockJwt);

        String rawRefresh = "raw-refresh-token";
        when(tokenService.hashToken(rawRefresh)).thenReturn("hashed");

        RefreshToken rt = RefreshToken.builder()
                .tokenHash("hashed")
                .revoked(false)
                .expiresAt(OffsetDateTime.now().plusDays(1))
                .build();
        when(refreshTokenRepository.findByTokenHash("hashed")).thenReturn(Optional.of(rt));
        when(refreshTokenRepository.save(any())).thenReturn(rt);

        authService.logout("access.token", rawRefresh);

        verify(tokenService).blacklist(mockJwt);
        assertThat(rt.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(rt);
    }

    // ---- helpers --------------------------------------------------------

    private User buildUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("alice@example.com")
                .passwordHash("$2a$10$hashed")
                .fullName("Alice")
                .build();
    }
}
