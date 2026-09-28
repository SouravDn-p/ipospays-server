# Nest Template

NestJS API template with PostgreSQL, Prisma, cookie JWT auth, and Docker.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22+, NestJS 12 (TypeScript, ESM) |
| Database | PostgreSQL 17 + Prisma ORM 7 |
| Auth | JWT (cookie-based), Passport, role guard |
| Media | Cloudinary |
| API docs | Swagger / OpenAPI at `/api/docs` |
| Containers | Docker + Docker Compose |

---

## Prerequisites

- [Node.js](https://nodejs.org/) **22+** and npm
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- GNU Make (optional — `make help`)

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

| Service | URL |
|---------|-----|
| API | http://localhost:5000/api/v1 |
| Swagger | http://localhost:5000/api/docs |
| Postgres (host) | `localhost:5432` |

### Full stack with Docker

```bash
make run-build
```

| Service | URL |
|---------|-----|
| API | http://localhost:5001/api/v1 |
| Swagger | http://localhost:5001/api/docs |

Stop with `make down`. Follow logs with `make logs`.

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

Copy `.env.example` → `.env`. Database is a single URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_template?schema=public
```

| Context | Host / port |
|---------|-------------|
| Nest on host | `localhost:5432` |
| Nest in Compose | `postgres:5432` (set by compose) |

---

## Project structure

```text
NestJs-Template/
├── Makefile
├── prisma/
├── src/
│   ├── config/
│   ├── common/
│   ├── services/
│   └── modules/          # auth, users, admin/plans
├── docker-compose.yml
└── Dockerfile
```

---

## License

UNLICENSED — private project.
