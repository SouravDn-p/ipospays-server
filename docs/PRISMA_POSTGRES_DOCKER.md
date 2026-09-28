# Prisma + PostgreSQL + Docker Compose Setup

This document describes how **Serv-server** connects NestJS to PostgreSQL using **Prisma ORM 7**, and how that database is run with **Docker Compose**.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Packages](#3-packages)
4. [Environment variables](#4-environment-variables)
5. [Prisma configuration (full code)](#5-prisma-configuration-full-code)
6. [NestJS Prisma integration (full code)](#6-nestjs-prisma-integration-full-code)
7. [Docker Compose (full code)](#7-docker-compose-full-code)
8. [Dockerfile (full code)](#8-dockerfile-full-code)
9. [Local development workflow](#9-local-development-workflow)
10. [Full stack with Docker Compose](#10-full-stack-with-docker-compose)
11. [Useful Prisma commands](#11-useful-prisma-commands)
12. [Connection string cheat sheet](#12-connection-string-cheat-sheet)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture overview

```
┌─────────────────────────────┐
│  Host machine               │
│                             │
│  Nest (npm run start:dev)   │
│  DATABASE_URL →             │
│  localhost:5433 ────────────┼──────┐
│                             │      │
│  Browser / API clients      │      │
│  http://localhost:5001 ─────┼──┐   │
└─────────────────────────────┘  │   │
                                 │   │
┌────────────────────────────────┼───┼──────────────────────────┐
│  Docker Compose network        │   │                          │
│                                ▼   ▼                          │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │  serv-backend    │    │  serv-postgres   │                 │
│  │  Nest + Prisma   │───▶│  Postgres 17     │                 │
│  │  port 5000       │    │  port 5432       │                 │
│  │                  │    │  user: serv      │                 │
│  │  migrate deploy  │    │  db:   serv_db   │                 │
│  │  then node app   │    │  volume: data    │                 │
│  └──────────────────┘    └──────────────────┘                 │
│         ▲                        ▲                            │
│         │ host 5001→5000         │ host 5433→5432             │
└─────────┼────────────────────────┼────────────────────────────┘
```

**Important design choice:** `.env` only stores **one** Postgres-related variable — `DATABASE_URL`.  
Compose hardcodes matching `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` for the Postgres container, and overrides `DATABASE_URL` for the app container so it uses the Docker hostname `postgres`.

---

## 2. Prerequisites

- Node.js **22+**
- npm
- Docker + Docker Compose
- Project dependencies installed:

```bash
cd Serv-server
npm install
```

---

## 3. Packages

Prisma 7 uses a **driver adapter** (`@prisma/adapter-pg` + `pg`) instead of the old built-in engine connection style.

### Runtime dependencies

| Package | Purpose |
|---------|---------|
| `@prisma/client` | Prisma Client runtime |
| `@prisma/adapter-pg` | PostgreSQL driver adapter |
| `pg` | `node-postgres` driver |
| `prisma` | CLI (generate / migrate) — kept in dependencies so Docker can run `migrate deploy` |
| `dotenv` | Loads `.env` for `prisma.config.ts` |
| `@nestjs/config` | Injects `DATABASE_URL` into the Nest app |

### Install (reference)

```bash
npm install @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg dotenv prisma@7.10.0
npm install -D @types/pg
```

### npm scripts (`package.json`)

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio"
  }
}
```

---

## 4. Environment variables

### `.env.example` (full file)

```env
# Postgres connection (Docker publishes host port 5433 → container 5432)
# Local app: use localhost:5433
# App inside Docker Compose: use host "postgres" and port 5432
DATABASE_URL=postgresql://serv:serv-sd-password@localhost:5433/serv_db

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
JWT_ACCESS_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800

PORT=5000
NODE_ENV=development

CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174
```

### URL format

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

| Part | Value in this project |
|------|------------------------|
| USER | `serv` |
| PASSWORD | `serv-sd-password` |
| HOST (local Nest) | `localhost` |
| HOST (app in Compose) | `postgres` |
| PORT (local Nest) | `5433` (published host port) |
| PORT (app in Compose) | `5432` (container port) |
| DATABASE | `serv_db` |

Copy the example file for local use:

```bash
cp .env.example .env
```

---

## 5. Prisma configuration (full code)

### File layout

```text
Serv-server/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20260911104441_init/
│           └── migration.sql
└── src/
    └── generated/prisma/   # created by `prisma generate` (gitignored)
```

### `prisma.config.ts` (full file)

In Prisma 7, the connection URL lives here (not as `url = env(...)` inside `schema.prisma`).

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### `prisma/schema.prisma` (full file)

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  admin
  user
}

model User {
  id                 String   @id @default(cuid())
  firstName          String
  lastName           String
  email              String   @unique
  password           String
  image              String?
  role               UserRole @default(user)
  hashedRefreshToken String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("users")
}
```

Notes:

- `provider = "prisma-client"` + custom `output` → client is generated into `src/generated/prisma`.
- `moduleFormat = "esm"` matches `"type": "module"` in `package.json`.
- Import the client from `../generated/prisma/client.js` (not `@prisma/client`).

### Initial migration SQL (full file)

`prisma/migrations/20260911104441_init/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "hashedRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
```

### `prisma/migrations/migration_lock.toml`

```toml
# Please do not edit this file manually
# It should be added in your version-control system (e.g., Git)
provider = "postgresql"
```

---

## 6. NestJS Prisma integration (full code)

### `src/config/db.config.ts` (full file)

Validates `DATABASE_URL` when Nest loads config (same clear error as PrismaService).

```ts
import { registerAs } from '@nestjs/config';

export interface DbConfig {
  url: string;
}

export default registerAs<DbConfig>('db', (): DbConfig => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not defined in the environment variables',
    );
  }

  return { url };
});
```

### `src/prisma/prisma.service.ts` (full file)

Uses a `pg` `Pool` + `PrismaPg` adapter (Prisma 7). Validates `DATABASE_URL` format, logs connect progress (without printing the password), and throws a clear error if Postgres is unreachable.

```ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly connectionTarget: string;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not defined in the environment variables',
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(connectionString);
    } catch {
      throw new Error(
        'DATABASE_URL is invalid. Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE',
      );
    }

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error(
        `DATABASE_URL protocol must be postgresql:// (received "${parsed.protocol}//")`,
      );
    }

    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
      throw new Error(
        'DATABASE_URL is incomplete. Host and database name are required.',
      );
    }

    const connectionTarget = `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
    this.connectionTarget = connectionTarget;

    this.logger.log(
      `PrismaService initialized (target: ${this.connectionTarget})`,
    );
  }

  async onModuleInit() {
    this.logger.log(
      `Prisma client connecting to database at ${this.connectionTarget}...`,
    );

    try {
      await this.$connect();
      // Force a real round-trip; $connect alone can succeed before auth/network fails
      await this.$queryRaw`SELECT 1`;
      this.logger.log(
        `Successfully connected to the database via PrismaPg adapter (${this.connectionTarget})`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to connect to database at ${this.connectionTarget}`,
      );
      this.logger.error(reason);

      await this.pool.end().catch(() => undefined);

      throw new Error(
        `Cannot connect to PostgreSQL using DATABASE_URL (target: ${this.connectionTarget}). ${reason}`,
      );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Prisma client and closing pg pool...');
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connections closed');
  }
}
```

#### Expected logs (healthy start)

```text
[Nest] ... LOG [PrismaService] PrismaService initialized (target: localhost:5433/serv_db)
[Nest] ... LOG [PrismaService] Prisma client connecting to database at localhost:5433/serv_db...
[Nest] ... LOG [PrismaService] Successfully connected to the database via PrismaPg adapter (localhost:5433/serv_db)
[Nest] ... LOG [NestApplication] Nest application successfully started
```

#### Expected error (missing `DATABASE_URL`)

```text
ERROR [ExceptionHandler] Error: DATABASE_URL is not defined in the environment variables
    at new PrismaService (.../src/prisma/prisma.service.ts)
```

#### Expected error (URL present but cannot connect)

```text
ERROR [PrismaService] Failed to connect to database at localhost:5433/serv_db: Can't reach database server at 127.0.0.1:5433
Error: Cannot connect to PostgreSQL using DATABASE_URL (target: localhost:5433/serv_db). Can't reach database server at 127.0.0.1:5433
```

Malformed URLs fail earlier in the constructor, for example:

```text
Error: DATABASE_URL is invalid. Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```


### `src/prisma/prisma.module.ts` (full file)

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` means any module can inject `PrismaService` without re-importing `PrismaModule`.

### `src/app.module.ts` (relevant full file)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import appConfig from './config/app.config.js';
import cloudinaryConfig from './config/cloudinary.config.js';
import dbConfig from './config/db.config.js';
import jwtConfig from './config/jwt.config.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, dbConfig, cloudinaryConfig, jwtConfig],
    }),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Example usage in a service

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }
}
```

---

## 7. Docker Compose (full code)

### `docker-compose.yml` (full file)

```yaml
services:
  server:
    build:
      context: .
      dockerfile: Dockerfile
    image: souravdebanth/serv-backend:latest
    container_name: serv-backend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      # Override host so the app container reaches the compose Postgres service
      DATABASE_URL: postgresql://serv:serv-sd-password@postgres:5432/serv_db
      NODE_ENV: production
    ports:
      - "5001:5000"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    container_name: serv-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: serv
      POSTGRES_PASSWORD: serv-sd-password
      POSTGRES_DB: serv_db
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U serv -d serv_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### What each part does

| Setting | Meaning |
|---------|---------|
| `postgres` service name | DNS hostname other containers use (`postgres`) |
| `POSTGRES_*` | Creates user/db on first volume init |
| `5433:5432` | Host tools / local Nest connect via `localhost:5433` |
| `healthcheck` | Backend waits until Postgres accepts connections |
| `environment.DATABASE_URL` on `server` | Overrides `.env` so container uses `postgres:5432`, not `localhost:5433` |
| `postgres_data` volume | Persists database files across restarts |

---

## 8. Dockerfile (full code)

### `Dockerfile` (full file)

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# prisma.config.ts requires DATABASE_URL even for generate
ENV DATABASE_URL="postgresql://serv:serv-sd-password@postgres:5432/serv_db"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

### Build stages explained

1. **builder**
   - Installs all deps
   - Runs `prisma generate` (needs a `DATABASE_URL` present because of `prisma.config.ts`)
   - Compiles Nest (`dist/`), including generated Prisma client under `dist/generated`

2. **runner**
   - Production deps only (`npm ci --omit=dev`)
   - Copies `dist`, `prisma/` migrations, and `prisma.config.ts`
   - On start: `prisma migrate deploy` then `node dist/main.js`

---

## 9. Local development workflow

Use this when Nest runs on the host and only Postgres runs in Docker.

### Step 1 — Start Postgres

```bash
cd Serv-server
docker compose up -d postgres
```

Wait until healthy:

```bash
docker compose ps
# serv-postgres ... (healthy)
```

### Step 2 — Configure `.env`

Ensure:

```env
DATABASE_URL=postgresql://serv:serv-sd-password@localhost:5433/serv_db
```

### Step 3 — Generate client + migrate

```bash
npm run prisma:generate
npm run prisma:migrate
# or first-time named migration:
# npx prisma migrate dev --name init
```

### Step 4 — Run Nest

```bash
npm run start:dev
```

App: `http://localhost:5000`  
Swagger: `http://localhost:5000/api/docs`  
Studio (optional): `npm run prisma:studio`

### Step 5 — Verify tables

```bash
docker compose exec postgres psql -U serv -d serv_db -c '\dt'
```

Expected:

```text
 public | _prisma_migrations | table | serv
 public | users              | table | serv
```

---

## 10. Full stack with Docker Compose

Use this when both Nest and Postgres run in containers.

```bash
cd Serv-server
docker compose up -d --build
```

What happens:

1. Postgres starts and becomes healthy
2. Backend image builds (`prisma generate` + `nest build`)
3. Backend container starts
4. `prisma migrate deploy` applies pending migrations
5. Nest listens on container port `5000` → host `http://localhost:5001`

Check logs:

```bash
docker compose logs -f server
```

Health check:

```bash
curl http://localhost:5001/
```

Stop:

```bash
docker compose down
```

Wipe database volume (destructive):

```bash
docker compose down -v
```

---

## 11. Useful Prisma commands

| Command | When to use |
|---------|-------------|
| `npm run prisma:generate` | After schema changes; regenerates client |
| `npm run prisma:migrate` | Local/dev: create + apply migration |
| `npm run prisma:deploy` | CI/Docker/prod: apply existing migrations only |
| `npm run prisma:studio` | GUI browser for data |
| `npx prisma migrate status` | See applied / pending migrations |
| `npx prisma db push` | Prototype without migration files (avoid in prod) |

### After changing `schema.prisma`

```bash
npx prisma migrate dev --name describe_your_change
npm run build   # if needed
```

Commit both:

- `prisma/schema.prisma`
- new folder under `prisma/migrations/`

---

## 12. Connection string cheat sheet

| Who is connecting | `DATABASE_URL` |
|-------------------|----------------|
| Nest on host | `postgresql://serv:serv-sd-password@localhost:5433/serv_db` |
| Nest in Compose (`server` service) | `postgresql://serv:serv-sd-password@postgres:5432/serv_db` |
| `psql` from host | `psql postgresql://serv:serv-sd-password@localhost:5433/serv_db` |
| `psql` inside container | `docker compose exec postgres psql -U serv -d serv_db` |

Why two hosts/ports?

- Inside Docker, services talk on the **container network** (`postgres:5432`).
- From the host, you use the **published** port (`localhost:5433`).

---

## 13. Troubleshooting

### `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`

- `.env` missing or not loaded
- Docker build: ensure `ENV DATABASE_URL=...` exists before `prisma generate`

### `Error: DATABASE_URL is not defined in the environment variables`

Thrown by `PrismaService` (and `db.config`) when `.env` has no `DATABASE_URL`.

- Add `DATABASE_URL=...` to `.env` (see `.env.example`)
- Restart `npm run start:dev` after editing `.env`
- For Compose app container, check the `environment.DATABASE_URL` override in `docker-compose.yml`

### `Error: Cannot connect to PostgreSQL using DATABASE_URL (target: ...)`

`DATABASE_URL` is set, but Nest cannot open a live connection (wrong host/port/password/db, or Postgres is down).

- Confirm Postgres is up: `docker compose up -d postgres` then `docker compose ps`
- Local Nest must use `localhost:5433`, not `postgres:5432`
- Compose app container must use `postgres:5432`, not `localhost`
- Check user / password / database name match the Postgres container
- Malformed strings fail earlier with `DATABASE_URL is invalid...`

### `P1001: Can't reach database server`

- Postgres not running: `docker compose up -d postgres`
- Wrong host: using `postgres` from the host machine (use `localhost`)
- Wrong port: using `5432` on the host (use `5433`)

### `EADDRINUSE` / Compose cannot bind `5001` or `5433`

Another process (often a stale Docker proxy) holds the port.

```bash
ss -ltn | rg '5001|5433'
docker compose down
# if still stuck, restart Docker Desktop / Docker daemon
```

### Migrations applied locally but not in container

Container uses `migrate deploy`, which only applies committed migration files.  
Ensure `prisma/migrations/**` is in the image context (not ignored) and rebuilt:

```bash
docker compose up -d --build
```

### Generated client missing

```bash
npm run prisma:generate
```

`src/generated/prisma` is gitignored; generate on every fresh clone / CI / Docker build.

### Schema change not reflected in DB

You edited `schema.prisma` but did not create a migration:

```bash
npx prisma migrate dev --name your_change
```

---

## Quick start (copy/paste)

```bash
cd Serv-server
cp .env.example .env
npm install
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Or everything in Docker:

```bash
cd Serv-server
cp .env.example .env
docker compose up -d --build
curl http://localhost:5001/
```
