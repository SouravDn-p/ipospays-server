.PHONY: help install lint format test test-watch test-cov test-e2e \
	prisma-generate prisma-migrate prisma-deploy prisma-studio \
	build start start-dev start\:dev start-debug start-prod \
	docker-build up run run-build down logs logs-f db-up db-down ps clean ci

COMPOSE ?= docker compose
IMAGE ?= nest-template:latest

help:
	@echo "Nest Template"
	@echo ""
	@echo "  Local"
	@echo "    make install          npm ci"
	@echo "    make start            nest start"
	@echo "    make start:dev        nest start --watch"
	@echo "    make start-debug      nest start --debug --watch"
	@echo "    make start-prod       node dist/main"
	@echo "    make build            compile to dist/"
	@echo "    make lint             oxlint"
	@echo "    make test             unit tests"
	@echo "    make ci               lint + test + build"
	@echo ""
	@echo "  Prisma"
	@echo "    make prisma-generate"
	@echo "    make prisma-migrate"
	@echo "    make prisma-deploy"
	@echo "    make prisma-studio"
	@echo ""
	@echo "  Docker"
	@echo "    make db-up            start Postgres"
	@echo "    make db-down          stop Postgres"
	@echo "    make up / make run    start stack (detached)"
	@echo "    make run-build        rebuild and start stack"
	@echo "    make down             stop stack"
	@echo "    make logs             follow compose logs (-f)"
	@echo "    make ps               compose status"
	@echo "    make docker-build     build $(IMAGE)"
	@echo "    make clean            rm dist/ coverage/"

install:
	npm ci

lint:
	npm run lint

format:
	npm run format

test:
	npm test

test-watch:
	npm run test:watch

test-cov:
	npm run test:cov

test-e2e:
	npm run test:e2e

prisma-generate:
	npm run prisma:generate

prisma-migrate:
	npm run prisma:migrate

prisma-deploy:
	npm run prisma:deploy

prisma-studio:
	npm run prisma:studio

build:
	npm run build

start:
	npm start

start-dev start\:dev:
	npm run start:dev

start-debug:
	npm run start:debug

start-prod:
	npm run start:prod

docker-build:
	docker build -t $(IMAGE) .

up run:
	$(COMPOSE) up -d

run-build:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs logs-f:
	$(COMPOSE) logs -f $(ARGS)

db-up:
	$(COMPOSE) up -d postgres

db-down:
	$(COMPOSE) stop postgres

ps:
	$(COMPOSE) ps

clean:
	rm -rf dist coverage

ci: lint test build
