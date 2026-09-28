# Authentication

**Scope:** `AuthModule` and `UsersModule`  
**Updated:** 28 Sep 2026

Cookie JWT auth for this API. Payment calls to iPOSpays use a separate merchant token. That flow is in [IPOSPAYS.md](IPOSPAYS.md), not these cookies.

---

## Cookies and CSRF

| Name | Set by | Used for |
|------|--------|----------|
| `access_token` | `POST /auth/login` and `POST /auth/refresh` | Authenticated routes. httpOnly. |
| `refresh_token` | same | `POST /auth/refresh` only (`Path=/api/v1/auth/refresh`). httpOnly. |
| `csrf_token` | same | Double-submit check. Readable by the browser. |

Send `x-csrf-token` with the same value as `csrf_token` on refresh. Login returns `data.csrfToken` as well.

Swagger at `/api/docs` documents cookie auth as `access_token` and the CSRF header as `x-csrf-token`.

---

## Routes

Prefix: `/api/v1`.

| Method | Path | Who |
|--------|------|-----|
| `POST` | `/auth/login` | Public. Body: email and password. Sets cookies. Returns the user and `csrfToken`. Throttled. |
| `POST` | `/auth/refresh` | Refresh cookie + CSRF. Rotates cookies and returns a new `csrfToken`. |
| `POST` | `/auth/logout` | Access cookie. Revokes the session and clears cookies. |
| `GET` | `/users/me` | Access cookie. |
| `GET` | `/users` | `SUPER_ADMIN`. |
| `POST` | `/users` | `SUPER_ADMIN`. |
| `GET` | `/users/:id/audit-logs` | `SUPER_ADMIN`. |
| `PATCH` | `/users/:id/deactivate` | `SUPER_ADMIN`. |

---

## `sub` in the token vs `userId` on the request

| Layer | Type | Field | Meaning |
|-------|------|-------|---------|
| Token claims | `JwtPayload` | `sub` | JWT subject. The user id. |
| Request principal | `JwtUser` | `userId` | Same id after Passport `validate`. |

Access token claims:

```ts
{ sub: userId, email, role, sessionId }
```

`JwtStrategy` maps `payload.sub` to `userId` and checks that the session is active. Controllers should read `req.user.userId`, not the raw `sub` claim.

```text
Inside the token  →  JwtPayload.sub
On the request    →  JwtUser.userId
Mapping           →  userId = payload.sub
```

`sessionId` is the session row. It is not the user id.
