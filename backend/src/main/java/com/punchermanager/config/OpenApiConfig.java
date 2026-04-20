package com.punchermanager.config;

import com.punchermanager.web.controller.AuthController;
import com.punchermanager.web.controller.PlanningMockController;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerMethod;

@Configuration
public class OpenApiConfig {

  static final String BEARER_SCHEME = "bearer-jwt";

  @Bean
  public OpenAPI puncherManagerOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("Puncher Manager API")
                .description(
                    "REST API for attendance, shifts, departments, teams, and notifications. "
                        + "Call **POST /api/auth/login** first, copy `token`, then click **Authorize** "
                        + "in Swagger UI and paste the JWT (Swagger adds the `Bearer ` prefix). "
                        + "Endpoints under login and mock planning require no JWT.")
                .version("1.0.0")
                .contact(new Contact().name("Puncher Manager"))
                .license(new License().name("Educational / PFE")))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER_SCHEME,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("JWT returned by POST /api/auth/login in field `token`")));
  }

  /**
   * Marks every operation as JWT-protected in the OpenAPI doc except login and public mock
   * planning, so “Try it out” sends Authorization after you click Authorize in Swagger UI.
   */
  @Bean
  public OperationCustomizer bearerSecurityCustomizer() {
    return (operation, handlerMethod) -> {
      if (isPublic(handlerMethod)) {
        return operation;
      }
      operation.addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
      return operation;
    };
  }

  private static boolean isPublic(HandlerMethod handlerMethod) {
    Class<?> ctrl = handlerMethod.getBeanType();
    return ctrl == AuthController.class || ctrl == PlanningMockController.class;
  }
}
