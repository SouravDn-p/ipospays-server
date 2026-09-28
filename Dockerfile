FROM node:22-alpine AS builder

WORKDIR /app

# Lockfile is generated with npm 11. The Node 22 image ships npm 10, and npm ci fails on it.
RUN npm install -g npm@11.19.0

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# prisma.config.ts requires DATABASE_URL even for generate
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/nest_template"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g npm@11.19.0

COPY package*.json ./
# prisma CLI is a devDependency, but the container runs migrate deploy on startup.
RUN npm ci --omit=dev && npm install --no-save --omit=dev prisma@7.10.0 && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
