# Swagger / OpenAPI — Puncher Manager (`SwaggerDocumenter`)

This document explains **what was added**, **where to open the UI**, **how to authenticate in Swagger**, and **how the OpenAPI JSON relates** to manual testing (`endpointTest01.md`).

---

## 1. What was integrated

| Piece | Purpose |
|--------|---------|
| **springdoc-openapi** (`springdoc-openapi-starter-webmvc-ui`) | Generates **OpenAPI 3** (`/v3/api-docs`) and hosts **Swagger UI** for interactive calls. |
| **`OpenApiConfig`** | API title, version, description, and **JWT Bearer** security scheme named `bearer-jwt`. |
| **`OperationCustomizer`** | Adds the Bearer requirement to **every** operation **except** `AuthController` (login) and `PlanningMockController` (mock planning), so “Try it out” uses your token after **Authorize**. |
| **`SecurityConfig`** | Allows **anonymous** access to Swagger assets (see below). |
| **`application.yml`** | `springdoc.*` settings (paths, sort order, persist authorization). |

No controller code had to be duplicated: Springdoc **reflects** your existing `@RestController` mappings, HTTP methods, path variables, and request bodies from DTOs.

---

## 2. URLs (default backend port `8080`)

| Resource | URL |
|----------|-----|
| **Swagger UI** (interactive docs) | http://localhost:8080/swagger-ui.html |
| **OpenAPI JSON** | http://localhost:8080/v3/api-docs |
| **OpenAPI YAML** (if enabled in your springdoc version) | Often http://localhost:8080/v3/api-docs.yaml — try it in the browser if needed |

With **Docker**, publish port `8080` on the host and use the same paths on **localhost**.

---

## 3. Using Swagger UI with JWT

1. Start the backend (`mvn spring-boot:run` or Docker).
2. Open **Swagger UI** (link above).
3. Expand **POST** `/api/auth/login` → **Try it out** → use body, for example:
   ```json
   { "email": "employee@puncher.com", "password": "demo123" }
   ```
4. **Execute** and copy **`token`** from the response.
5. Click **Authorize** (top), paste **only the JWT string** (Swagger adds `Bearer ` for HTTP bearer scheme).
6. Call other endpoints (punch, users, etc.) with **Try it out**.

`springdoc.swagger-ui.persist-authorization: true` keeps the token in the browser session while the tab stays open.

---

## 4. Which endpoints appear as “public” in the spec

| Controller | Behavior in OpenAPI |
|------------|---------------------|
| **AuthController** | No Bearer requirement — login stays callable without Authorize. |
| **PlanningMockController** | No Bearer requirement — mock planning GET stays public (matches Spring Security `permitAll`). |
| **All other controllers** | Bearer (`bearer-jwt`) listed so Swagger UI sends `Authorization: Bearer &lt;token&gt;` after you authorize. |

This mirrors runtime security: JWT filter + `@PreAuthorize` on methods.

---

## 5. Relationship to other documentation

| File | Role |
|------|------|
| **`endpointTest01.md`** | Step-by-step **Postman** tables for each route (good for reports and offline testing). |
| **`SwaggerDocumenter.md`** (this file) | Explains **Swagger/OpenAPI** integration and UI usage. |
| **Live `/v3/api-docs`** | Machine-readable **single source** for codegen clients (Angular, Kotlin, etc.). |

When you change controllers, **refresh Swagger UI** — the spec updates automatically on the next request.

---

## 6. Production notes

- **Do not** expose Swagger UI on the public internet without protection (IP allowlist, VPN, or separate admin profile).  
- Set `springdoc.api-docs.enabled=false` and `springdoc.swagger-ui.enabled=false` in **production** if you disable docs entirely, or gate them behind Spring Security roles.

Example (conceptual — adapt to your deployment):

```yaml
springdoc:
  swagger-ui:
    enabled: ${SWAGGER_ENABLED:false}
  api-docs:
    enabled: ${SWAGGER_ENABLED:false}
```

---

## 7. Troubleshooting

| Issue | Check |
|-------|--------|
| 401 on `/swagger-ui.html` | **SecurityConfig** must `permitAll` for `/swagger-ui/**` and `/v3/api-docs/**`. |
| Authorize still gets 401 | Token expired (JWT TTL 8h default); login again. Wrong role for endpoint → 403. |
| Empty or partial spec | Ensure controllers are in a package **under** the Spring Boot main application’s component scan (`com.punchermanager`). |

---

## 8. Quick reference — Maven dependency

```xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
  <version>2.5.0</version>
</dependency>
```

(Version aligned with Spring Boot **3.2.x** in this project.)

---

*End of SwaggerDocumenter.*
