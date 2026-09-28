# Admin Authentication Guide

**Scope:** Platform admin auth (`AdminAuthModule` + `AdminsModule`)  
**Updated:** 17 Sep 2026

---

## Why `sub` in the JWT payload vs `adminId` on `JwtAdmin`?

These are **two different layers** of the same identity.

| Layer | Type | Field | Meaning |
|-------|------|-------|---------|
| Token claims (on the wire / in the cookie) | `JwtPayload` | `sub` | Standard JWT claim for the **subject** (who the token is about) |
| Request principal (after Passport `validate`) | `JwtAdmin` | `adminId` | App-facing name for that same admin UUID |

### What each is for

**`JwtPayload.sub`** — signed into the access/refresh JWT:

```ts
{ sub: adminId, email, role, sessionId }
```

- `sub` is the [JWT registered claim](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2) for subject.
- Libraries, logging, and interoperability expect `sub`, not `adminId`.
- The raw cookie token always uses this shape.

**`JwtAdmin.adminId`** — what Passport puts on `req.user` after `validate()`:

```ts
// strategy maps: payload.sub → adminId
return { adminId: payload.sub, email, role, sessionId }
```

- Controllers/services should not dig into JWT claim jargon.
- Naming stays clear next to a future `JwtUser.userId` (tenant users).
- Avoids confusion with `sessionId` (session row, not the admin).

### Rule of thumb

```text
Inside the token  →  use JwtPayload  →  field name: sub
On the request    →  use JwtAdmin    →  field name: adminId
Mapping           →  adminId = payload.sub   (always)
```

**Bug we hit earlier:** refresh strategy set `adminId: payload.sessionId` instead of `payload.sub`. That confused “who is logged in” with “which session row,” and refresh issued tokens for the wrong subject.

---

## High-level architecture

```text
Browser / Admin UI
        │
        │  credentials / cookies (credentials: include)
        ▼
┌───────────────────────────────────────────────────────────┐
│  Nest API  (prefix: /api/v1)                              │
│                                                           │
│  AdminAuthController                                      │
│    POST /admin-auth/create   bootstrap first SUPER_ADMIN  │
│    POST /admin-auth/login    issue cookies                │
│    POST /admin-auth/refresh  rotate cookies               │
│    POST /admin-auth/logout   revoke session               │
│                                                           │
│  AdminsController  (JWT + Roles + CSRF)                   │
│    GET    /admins                                         │
│    POST   /admins                                         │
│    GET    /admins/:id/audit-logs                          │
│    PATCH  /admins/:id/deactivate                          │
│                                                           │
│  Passport strategies                                      │
│    admin-jwt          ← cookie admin_access_token         │
│    admin-refresh-jwt  ← cookie admin_refresh_token        │
│                                                           │
│  Hardening                                                │
│    Helmet · ThrottlerGuard · AdminCsrfGuard · audit logs  │
│                                                           │
│  Postgres                                                 │
│    platform_admins  +  admin_sessions  +  admin_audit_logs│
└───────────────────────────────────────────────────────────┘
```

Cookies:

| Cookie | httpOnly | Path | Purpose |
|--------|----------|------|---------|
| `admin_access_token` | yes | `/` | Short-lived API auth → `admin-jwt` |
| `admin_refresh_token` | yes | `/api/v1/admin-auth/refresh` | Rotation only → `admin-refresh-jwt` |
| `admin_csrf_token` | **no** | `/` | Double-submit CSRF; send as `X-CSRF-Token` |

Secrets / flags (env):

- `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN` (e.g. `15m`) / `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`)
- `ALLOW_ADMIN_BOOTSTRAP` — required `true` in production for first-admin create

Passwords: **argon2id** (`password.util.ts`).
SameSite: **strict** on all admin cookies.

---

## End-to-end flows

### 1. Bootstrap first admin (one-time)

```text
POST /api/v1/admin-auth/create
Body: { name, email, password, role? }

→ count(platform_admins where deletedAt null)
→ if count > 0  →  403 (use POST /admins as SUPER_ADMIN instead)
→ if count = 0  →  create with role forced to SUPER_ADMIN
→ return SafeAdmin (no password)
```

No JWT required for this path. After the first admin exists, this route is closed.

### 2. Login

```text
POST /api/v1/admin-auth/login
Body: { email, password }

→ find admin by email (incl. password hash)
→ reject if locked / inactive / bad password (same "Invalid credentials" message)
→ on failure: increment failedLoginAttempts; lock 15m after 5 fails
→ on success: reset attempts; create AdminSession (refreshTokenHash = pending)
→ sign access + refresh JWTs (JwtPayload with sub = admin.id)
→ store SHA-256(refreshToken) on session
→ Set-Cookie: admin_access_token, admin_refresh_token, admin_csrf_token
→ body: { admin: SafeAdmin, csrfToken }   ← JWTs only in cookies
```

### 3. Authenticated request

```text
Any protected route (e.g. GET /admins)
Cookie: admin_access_token=...

→ AdminJwtGuard → strategy admin-jwt
→ verify JWT with jwt.adminAccessSecret (ConfigService)
→ validate(payload):
     load AdminSession by payload.sessionId
     reject if revoked / expired / admin not active
     return JwtAdmin { adminId: payload.sub, ... }
→ Passport sets req.user = JwtAdmin
→ AdminRolesGuard (if @ADMIN_ROLE present):
     requiredRoles.includes(req.user.role)
→ AdminCsrfGuard: skip for GET; for mutating methods require
     cookie admin_csrf_token === header X-CSRF-Token
→ controller runs
```

### 4. Refresh

```text
POST /api/v1/admin-auth/refresh
Cookie: admin_refresh_token=... (path-scoped) + admin_csrf_token
Header: X-CSRF-Token: <csrf>

→ AdminCsrfGuard + AdminRefreshJwtGuard → strategy admin-refresh-jwt
→ verify with jwt.adminRefreshSecret
→ validate → JwtAdmin { adminId: payload.sub, sessionId, ... }
→ service:
     load session by admin.sessionId
     compare SHA-256(cookie refresh) to session.refreshTokenHash
     mismatch → revoke session (reuse detection) + 401
     match → issue new access + refresh, update hash, reset cookies + new CSRF
```

### 5. Logout

```text
POST /api/v1/admin-auth/logout
Cookie: admin_access_token=... + admin_csrf_token
Header: X-CSRF-Token: <csrf>

→ AdminJwtGuard + AdminCsrfGuard
→ revoke session; audit LOGOUT
→ clear admin_access_token, admin_refresh_token, admin_csrf_token
```

---

## Type map (read this when debugging)

```text
issueToken()
  builds JwtPayload { sub, email, role, sessionId }
  signs into cookies

AdminJwtStrategy.validate(payload: JwtPayload)
  → JwtAdmin { adminId: payload.sub, email, role, sessionId }
  → req.user

AdminJwtRefreshStrategy.validate(payload: JwtPayload)
  → same JwtAdmin mapping

Controllers
  always use:  const admin = req.user as JwtAdmin
  never use:   req.admin, req.sub, payload.sub in controllers
```

---

## Role model

| Role | Typical use |
|------|-------------|
| `SUPER_ADMIN` | Create/list/deactivate admins |
| `BILLING_ADMIN` | (reserved; not enforced on routes yet beyond schema) |
| `SUPPORT_ADMIN` | (reserved) |

Enforcement:

- Decorator `@ADMIN_ROLE(...)` sets metadata only.
- **`AdminRolesGuard` must run** (it does on `AdminsController` via `@UseGuards(AdminJwtGuard, AdminRolesGuard)`).
- Metadata without the guard = no protection (that was a prior bug).

---

## What was broken (before the fix pass)

| Issue | Impact |
|-------|--------|
| Login `@Res()` without `passthrough: true` | Response body from `return ApiResponse...` was dropped |
| Refresh used `req.admin` | Property never set → TS + runtime failure |
| Logout used `req.sub` | Wrong; identity lives on `req.user` |
| `setAdminAuthCookies(res, a, b)` wrong arity | Build error; expected `(res, { accessToken, refreshToken })` |
| `AdminJwtRefreshStrategy` not in module providers | Refresh → unknown strategy |
| Refresh `validate` set `adminId = sessionId` | Identity mix-up on rotate |
| `@ADMIN_ROLE` without `AdminRolesGuard` | Create/list/deactivate effectively open |
| Cookie option `samesite` typo | SameSite not applied (`sameSite` required) |
| `getAllAdmins` count ignored soft-delete | Wrong pagination total |
| Lockout did not reset attempt counter | Odd re-lock after unlock |
| `.env.example` wrong JWT names / numeric TTLs | Docs would break `durationToMs` |

---

## What we fixed

### Pass 1 — build / wiring
1. Login `@Res({ passthrough: true })`; refresh/logout use `req.user as JwtAdmin`.
2. Registered refresh strategy; `adminId ← payload.sub`.
3. `/admins` JWT + role guards; bootstrap gated by zero admins.
4. Cookie `sameSite`; soft-delete count; lockout reset; `.env.example` aligned.

### Pass 2 — SEC-04 … SEC-10
5. **SEC-05** — Cookies renamed: `admin_access_token`, `admin_refresh_token`, `admin_csrf_token`.
6. **SEC-10** — Refresh cookie path narrowed to `/api/v1/admin-auth/refresh`.
7. **SEC-07** — Strategies + cookies use `ConfigService`; boot `assertRequiredAuthEnv`.
8. **SEC-04** — Double-submit CSRF (`AdminCsrfGuard` + `X-CSRF-Token`); login/bootstrap exempt.
9. **SEC-08** — Helmet + global Throttler (100/min); login 5/min; bootstrap 3/min.
10. **SEC-09** — Audit actions: `LOGIN`, `LOGIN_FAILED`, `TOKEN_REFRESH`, `LOGOUT`, `ADMIN_CREATED`, `ADMIN_DEACTIVATED`, `ADMIN_BOOTSTRAP`; `GET /admins/:id/audit-logs`.
11. Bootstrap: `ALLOW_ADMIN_BOOTSTRAP` + Serializable transaction + P2002/P2034 → 403.

`nest build` succeeds after these changes.

---

## Client CSRF usage

```text
1. POST /admin-auth/login  →  cookies set + body.csrfToken
2. For POST/PATCH/DELETE (logout, refresh, /admins/*):
     Header: X-CSRF-Token: <value of admin_csrf_token cookie or body.csrfToken>
     credentials: 'include'
3. GET /admins  — CSRF not required
```

---

## Remaining product gaps (auth hardening closed)

| Area | Status |
|------|--------|
| Plans CRUD | Stub |
| Tenants module | Missing |
| Session list / revoke UI | Not built |
| Password reset | Not built |

---

## Quick test checklist

1. Empty DB + `ALLOW_ADMIN_BOOTSTRAP=true` → `POST /admin-auth/create` → 200 SUPER_ADMIN.
2. Same create again → 403.
3. `POST /admin-auth/login` → `admin_*` cookies + `csrfToken` in body.
4. `GET /admins` with access cookie → 200 (no CSRF header needed).
5. `POST /admins` without `X-CSRF-Token` → 403.
6. `POST /admins` with matching CSRF → 200.
7. `POST /admin-auth/refresh` with refresh cookie + CSRF → new cookies.
8. `POST /admin-auth/logout` with access + CSRF → cleared cookies.
9. Wrong password ×5 → lockout; audit `LOGIN_FAILED`.
10. `GET /admins/:id/audit-logs` as SUPER_ADMIN → logs.

Use Swagger at `/api/docs` or any client with `credentials: 'include'`.

---

## File map

```text
src/
  modules/admin/
    admin-auth/          login, refresh, logout, bootstrap
    admins/              list/create/deactivate + audit-logs
  common/
    strategies/admin/    admin-jwt, admin-refresh-jwt (ConfigService)
    guards/              Jwt, Refresh, Roles, Csrf
    utils/cookie.util.ts admin_* cookie helpers
    utils/audit.util.ts  logAdminAction
    utils/assert-auth-env.ts
  config/jwt.config.ts
  main.ts                helmet + assertRequiredAuthEnv
  app.module.ts          ThrottlerModule + APP_GUARD
```

---

## Bottom line

- **`sub`** = JWT subject claim (inside the token).
- **`adminId`** = same value on `req.user` after strategy mapping.
- Always map `adminId ← payload.sub`. Never map `adminId ← sessionId`.
- Mutating admin requests need **JWT + CSRF** (and roles where decorated).