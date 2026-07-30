.PHONY: up down logs migrate seed test build test-infra-up test-infra-down

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

migrate:
	cd backend && pnpm migration:run

seed:
	cd backend && pnpm seed:admin

test:
	cd backend && pnpm test

test-infra-up:
	docker compose -f docker-compose.test.yml up -d

test-infra-down:
	docker compose -f docker-compose.test.yml down -v

build:
	cd backend && pnpm build
