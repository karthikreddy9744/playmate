package com.playmate.config;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.playmate.service.JwtService;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final String allowedOrigins;

    public SecurityConfig(
            JwtService jwtService,
            UserDetailsService userDetailsService,
            @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:5173}") String allowedOrigins
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authz -> authz
                // Allow pre-flight OPTIONS requests globally FIRST
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Public endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/games/requests/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/games/**").permitAll()
                // Debug endpoints (development only)
                .requestMatchers("/api/debug/**").permitAll()
                // Swagger & Actuator
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/test").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                // WebSocket: allow SockJS handshake & upgrade
                .requestMatchers("/ws/**").permitAll()
                // Allow dev-only seeder endpoints (controller itself checks the flag)
                .requestMatchers("/internal/dev/**").permitAll()
                // Allow internal cleanup triggered by external cron (controller checks secret key)
                .requestMatchers("/internal/cleanup").permitAll()
                // Admin-only endpoints
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // All other requests must be authenticated
                .anyRequest().authenticated()
            )
            .addFilterBefore(new JwtAuthenticationFilter(jwtService, userDetailsService), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        log.info("Configured raw allowed-origins property: {}", allowedOrigins);
        
        // Split and trim origins, filtering out unresolved placeholders
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .filter(s -> !s.contains("${"))
                .collect(Collectors.toList());
        
        log.info("Parsed allowed origins: {}", origins);
        if (origins.isEmpty()) {
            origins = Arrays.asList("http://localhost:3000", "http://localhost:3001", "http://localhost:5173");
        }
        
        configuration.setAllowedOrigins(origins);
        // Do NOT use "*" with allowCredentials(true). Use setAllowedOriginPatterns if needed.
        // But since we have origins list, we can just use that.
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
            "Authorization", 
            "Content-Type", 
            "X-Requested-With", 
            "Accept", 
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
        ));
        configuration.setExposedHeaders(Arrays.asList(
            "Access-Control-Allow-Origin", 
            "Access-Control-Allow-Credentials"
        ));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
