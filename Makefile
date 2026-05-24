# Makefile for bb-mcp: Docker, test, lint, build

.PHONY: all test lint build docker-lint docker-test docker-build docker-up docker-down docker-logs docker-doctor docker-probe docker-manifest docker-tools

all: test

test:
	npm test

lint:
	npm run lint

build:
	npm run build

docker-test:
	docker build --target test -t bb-mcp:test .
	docker run --rm bb-mcp:test npm run lint
	docker run --rm bb-mcp:test npm run test:coverage
	docker run --rm bb-mcp:test npm audit --audit-level=high

docker-lint:
	docker build --target test -t bb-mcp:test .
	docker run --rm bb-mcp:test npm run lint

docker-build:
	docker build -t bb-mcp:latest .

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f bb-mcp

docker-doctor:
	docker compose run --rm bb-mcp node dist/index.js --doctor

docker-probe:
	docker compose run --rm bb-mcp node dist/index.js --probe

docker-manifest:
	docker compose run --rm bb-mcp node dist/index.js --manifest

docker-tools:
	docker compose run --rm bb-mcp node dist/index.js --tools
