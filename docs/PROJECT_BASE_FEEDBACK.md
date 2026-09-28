# Serv-server — Project Base Feedback

**Date:** 15 Sep 2026  
**Scope:** NestJS API base (Prisma 7 + PostgreSQL + Docker Compose)  
**Overall progress:** ~40–50% of a production-ready platform API foundation

---

## Executive summary

You have a **credible platform skeleton**: Nest 12, Prisma 7 with `pg` adapter, Postgres in Docker, config modules, global API envelope (filter + interceptor), Swagger bootstrap, and the start of an admin domain (`PlatformAdmin`, plans, auth scaffolding).

What is still missing is the **product surface**: auth is not wired end-to-end, most admin modules are stubs, schema is ahead of migrations for tenant/billing tables, uploads/Cloudinary are not plugged into `AppModule`, and tests/docs have drifted.

**Verdict:** Strong infra base. Next milestone should be “admin auth works + schema matches DB + one complete CRUD vertical (plans or admins).”

---

## Progress scorecard

| Area | Score | Notes |
|------|-------|-------|
| Project / Nest bootstrap | ★★★★☆ | CORS, cookies, ValidationPipe, Swagger wired |
| Config & env | ★★★☆☆ | Modules exist; JWT env names inconsistent |
| Prisma + DB | ★★★☆☆ | Client + connection validation good; **schema/migration drift** |
| Docker Compose | ★★★★☆ | Postgres + server compose is usable |
| Docker production image | ★★☆☆☆ | `prisma` CLI is only in `devDependencies` but CMD runs `migrate deploy` |
| Cross-cutting (filter/interceptor) | ★★★★☆ | Solid API response shape |
| Auth (admin/user JWT) | ★★☆☆☆ | Strategies/guards written; **not registered / no login flow** |
| Admin APIs | ★☆☆☆☆ | Modules scaffolded; mostly empty or broken |
| Tenants | ★☆☆☆☆ | Placeholder only |
| Uploads / Cloudinary | ★★☆☆☆ | Code exists; module not imported; service DI incomplete |
| Tests | ★☆☆☆☆ | Scaffolds; expectations outdated |
| Docs | ★★★☆☆ | Prisma/Docker guide exists but partially stale |

---

## What’s in good shape

### 1. Runtime foundation
- Nest ESM project (`"type": "module"`) with clean `main.ts` bootstrap.
- Global `ValidationPipe`, cookie parser, CORS from config.
- Swagger at `/api/docs`.
- Consistent success/error envelope via interceptor + exception filter.

### 2. Prisma 7 integration
- `PrismaService` validates missing/invalid `DATABASE_URL`, logs connect target (without password), and fails clearly when Postgres is unreachable.
- Global `PrismaModule` is available for injection.
- Domain direction in schema is clear: platform admins, plans, tenants, subscriptions.

### 3. Docker Compose path
- `postgres:17-alpine` with healthcheck.
- Host port `5433 → 5432` for local Nest.
- App container overrides `DATABASE_URL` to `postgres:5432`.
- Documented workflow under `docs/PRISMA_POSTGRES_DOCKER.md`.

### 4. Module layout starting to match a SaaS admin console
```text
src/
  config/
  common/   (guards, strategies, filters, decorators)
  services/ (prisma, cloudinary)
  modules/admin/ (admin-auth, admins, plans)
  modules/tenants/ (placeholder)
```

This is the right shape for a multi-tenant restaurant/servicing platform.

---

## What’s incomplete or blocked

### 1. Schema ahead of migrations (critical)
**Schema defines:** `Plan`, `Subscription`, `SubscriptionHistory`, `Tenant` (+ related enums).  
**Migrated/applied so far:** `PlatformAdmin`, `AdminAuditLog` (after dropping legacy `users`).

Until you run a new migration, any Plans/Tenants code will fail at runtime against the live DB.

**Action:**  
`npx prisma migrate dev --name plans_tenants_subscriptions`

### 2. Auth scaffolding is dead code
Present but unwired:
- `admin-jwt.strategy.ts`, `user-jwt.strategy.ts`
- `AdminJwtAuthGuard`, `UserJwtAuthGuard`, `AdminRoleGuard`
- `@Public()`, `@ROLE()`

Missing:
- `PassportModule` / strategy providers in modules
- Global `APP_GUARD`
- Login / refresh / logout endpoints that set httpOnly cookies
- Password hashing library (`bcrypt` or `argon2`)
- Seed for first `SUPER_ADMIN`

Also: strategies read `ADMIN_JWT_ACCESS_SECRET` / `USER_JWT_ACCESS_SECRET`, while `jwt.config.ts` and `.env.example` use different names. That will break auth even after wiring.

### 3. Admin feature modules are stubs
| Module | Reality |
|--------|---------|
| `admin-auth` | Empty controller/service; `AdminLoginDto` unused |
| `admins` | `GET /admins` queries DB but **never returns** data |
| `plans` | Empty controller/service |
| `tenants` | Empty placeholder file only |

Example bug in `admins.service.ts`:

```ts
const [admins, total] = await this.prisma.$transaction([...])
// missing: return { admins, total }
```

### 4. Cloudinary / uploads not integrated
- Upload helpers exist under `services/cloudinary/`.
- Module is **not** imported in `AppModule`.
- `CloudinaryService` is not cleanly registered/exported for DI.
- No upload route yet.

### 5. Docker runner risk
Dockerfile CMD:

```sh
npx prisma migrate deploy && node dist/main.js
```

But `prisma` is in **devDependencies**, and the runner uses `npm ci --omit=dev`. Production containers may fail at migrate time.

### 6. Tests and hello endpoint drift
- Specs still expect raw `"Hello World!"`.
- App returns wrapped `ApiResponse` with `"WellCome To Serv Server"`.
- E2E will need DB + Prisma mocks/fixtures.

### 7. Docs partially stale
`docs/PRISMA_POSTGRES_DOCKER.md` still reflects earlier `User` model / older PrismaService paths in places. Worth a refresh after the next auth + migration pass.

---

## Architecture feedback

### Strengths
- Separating `services/` (infra) from `modules/` (domain) is good.
- Global Prisma + config namespaces scale well.
- Admin roles (`SUPER_ADMIN` / `ADMIN` / `SUPPORT`) and tenant roles (`OWNER`…`BARTENDER`) show clear product thinking.
- Cookie-based JWT direction matches a browser admin dashboard.

### Risks / design nits
1. **Same cookie name `accessToken` for admin and user** will collide if both systems run in one browser origin. Prefer `admin_access_token` / `user_access_token` (or separate domains).
2. **`JwtPayload.sub` typed as `number`** while Prisma IDs are `cuid` strings — fix types early.
3. **User JWT strategy living under `common/strategies/admin/`** is confusing; move to `strategies/user/`.
4. **Filename typo:** `prisma-exeption-handler.ts` (exception). Rename when convenient.
5. **Hardcoded DB credentials** in compose/Dockerfile are fine for local demos; don’t ship them as production secrets.
6. **Port default mismatch:** `app.config` defaults to `7000`, `.env.example` uses `5000`.

---

## Recommended next milestones

### Milestone A — Make the base trustworthy (1–2 days)
1. Create migration for `Plan` / `Tenant` / `Subscription` / `SubscriptionHistory`.
2. Align JWT env names across `.env`, `.env.example`, `jwt.config`, and strategies.
3. Move `prisma` to `dependencies` (or otherwise make Docker migrate reliable).
4. Fix `getAllAdmins` return.
5. Add password hashing + seed script for one `SUPER_ADMIN`.

### Milestone B — Admin auth vertical (2–3 days)
1. Wire `AdminAuthModule` with Passport JWT strategy + JwtModule.
2. Implement `POST /admin-auth/login`, refresh, logout (httpOnly cookies).
3. Register global `AdminJwtAuthGuard` + `@Public()` on login.
4. Protect `/admins` and `/plans` with role guards.
5. Write audit log entries on sensitive admin actions.

### Milestone C — First real product CRUD (2–4 days)
1. Complete Plans CRUD (schema is ready).
2. Scaffold real Tenants module (create/list/suspend).
3. Wire Cloudinary for logo/image upload on tenant/plan assets.
4. Document routes in Swagger (cookie auth scheme).

### Milestone D — Hardening
1. `/health` readiness (DB ping).
2. Helmet + rate limiting.
3. Fix unit/e2e tests; CI: lint → migrate → test.
4. Refresh project docs (this feedback + Prisma guide).

---

## Suggested build order (short)

```text
migrate schema  →  seed SUPER_ADMIN  →  admin login cookies
      →  protect routes  →  plans CRUD  →  tenants CRUD
      →  uploads  →  tests/CI  →  docs refresh
```

Avoid starting tenant user auth until admin auth + plans/tenants CRUD are solid; otherwise you’ll maintain two unfinished auth stacks.

---

## File map (current base)

```text
Serv-server/
├── Dockerfile / docker-compose.yml
├── prisma.config.ts
├── prisma/schema.prisma
├── prisma/migrations/
│   ├── 20260911104441_init/
│   └── 20260915104622_admin_tables/
├── docs/
│   ├── PRISMA_POSTGRES_DOCKER.md
│   └── PROJECT_BASE_FEEDBACK.md   ← this file
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── config/          ✅ mostly done
    ├── common/          ⚠️ written, not fully wired
    ├── services/
    │   ├── prisma/      ✅ solid
    │   └── cloudinary/  ⚠️ not imported
    └── modules/
        ├── admin/
        │   ├── admin-auth/  ❌ stub
        │   ├── admins/      ⚠️ broken list
        │   └── plans/       ❌ stub
        └── tenants/         ❌ placeholder
```

---

## Bottom line

You’re past “empty Nest starter.” The **infra layer is real** and the **domain model direction is clear**. The gap is execution on the first vertical: **wired admin auth + migrations matching schema + one complete CRUD module**.

Close Milestone A and B next; after that the project will feel like an actual platform backend instead of a scaffold with good plumbing.
