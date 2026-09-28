# iPOSpays Server

NestJS API for the iPOSpays app. It serves health, cookie-based auth, and user management today. Card payments are integrated against the **iPOSpays sandbox (UAT)** first. Production hosts are used only after sandbox payments succeed.

Payment setup, sandbox vs production URLs, and the switch checklist live in [docs/IPOSPAYS.md](docs/IPOSPAYS.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22+, NestJS 12 (TypeScript, ESM) |
| Database | PostgreSQL 17 + Prisma ORM 7 |
| Auth | JWT in httpOnly cookies, CSRF header, role checks |
| Payments | iPOSpays sandbox, then production ([guide](docs/IPOSPAYS.md)) |
| API docs | Swagger / OpenAPI at `/api/docs` |
| Containers | Docker + Docker Compose |

---

## Prerequisites

- [Node.js](https://nodejs.org/) **22+** and npm
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- GNU Make (optional — `make help`)
- An iPOSpays **sandbox** merchant with a TPN, API key, and secret key (needed when payment calls are added)

---

## Quick start

```bash
cp .env.example .env
make install
make db-up
make prisma-generate
make prisma-deploy
make start:dev
```

`PORT` defaults to **7000** when it is unset (`src/config/app.config.ts`).

| Service | URL |
|---------|-----|
| API | http://localhost:7000/api/v1 |
| Health | http://localhost:7000/api/v1 |
| Swagger | http://localhost:7000/api/docs |
| Postgres (host) | `localhost:5433` |

### Full stack with Docker

Compose publishes `5001 → 5000`. Set `PORT=5000` in `.env` so the process listens on the mapped port.

```bash
make run-build
```

| Service | URL |
|---------|-----|
| API | http://localhost:5001/api/v1 |
| Swagger | http://localhost:5001/api/docs |

Stop with `make down`. Follow logs with `make logs`.

---

## API surface

Global prefix: `/api/v1`. JSON uses one envelope: `success: true` with `data`, or `success: false` with an error.

| Area | Routes | Auth |
|------|--------|------|
| Health | `GET /` | Public |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Login is public. Refresh needs the refresh cookie and `x-csrf-token`. Logout needs the access cookie. |
| Users | `GET /users/me`, `GET /users`, `POST /users`, `GET /users/:id/audit-logs`, `PATCH /users/:id/deactivate` | Access cookie. List, create, audit logs, and deactivate require `SUPER_ADMIN`. |
| Plans | `plans` controller is registered and has no routes yet | — |

Auth details: [docs/auth.md](docs/auth.md).

Payment routes are not exposed yet. The next integration step is the iPOSpays sandbox, described in [docs/IPOSPAYS.md](docs/IPOSPAYS.md).

---

## Make targets

```bash
make help              # list all targets
make ci                # lint + test + build
make start:dev         # local Nest watch
make db-up             # Postgres only
make up                # start stack
make run-build         # rebuild and start stack
make logs              # follow compose logs
make down              # stop stack
```

---

## Environment

Copy `.env.example` → `.env`. The database is a single URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nest_template?schema=public
```

| Context | Host / port |
|---------|-------------|
| Nest on the host | `localhost:5433` |
| Nest in Compose | `postgres:5432` (set by compose) |

iPOSpays keys in `.env.example` are commented. Fill the sandbox values before payment calls are added. Do not point those variables at production until sandbox sales, status checks, and refunds or voids have been verified.

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port. Default `7000`. Use `5000` inside Compose. |
| `NODE_ENV` | `development` locally. Production refuses weak JWT secrets. |
| `CORS_ORIGINS` | Comma-separated browser origins. |
| `DATABASE_URL` | Postgres connection string. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Required in production. Dev fallbacks exist only outside production. |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Defaults `15m` and `7d`. |
| `IPOSPAYS_ENV` | `sandbox` while testing, `production` after sign-off. |
| `IPOSPAYS_API_KEY` / `IPOSPAYS_SECRET_KEY` | Portal keys for that environment. |
| `IPOSPAYS_TPN` | Merchant TPN for that environment. |
| `IPOSPAYS_TOKEN_EXPIRY_MINUTES` | Auth-token lifetime, 30–1440. |

---

## Project structure

```text
Ipospays-server/
├── Makefile
├── prisma/
├── docs/
│   ├── IPOSPAYS.md          # sandbox, then production
│   ├── auth.md
│   └── PRISMA_POSTGRES_DOCKER.md
├── src/
│   ├── config/
│   ├── common/
│   ├── services/
│   └── modules/             # auth, users, admin/plans
├── docker-compose.yml
└── Dockerfile
```

---

## License

UNLICENSED — private project.
