# Makefile for bb-mcp: Docker, test, lint, build

.PHONY: all test lint build docker-lint docker-test docker-build docker-up docker-down docker-logs docker-doctor docker-probe docker-manifest docker-tools docker-inspect

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
	docker run --rm bb-mcp:test npm run metrics:complexity
	docker run --rm bb-mcp:test npm run metrics:docs

docker-lint:
	docker build --target test -t bb-mcp:test .
	docker run --rm bb-mcp:test npm run lint

docker-build:
	docker build -t bb-mcp:latest .

docker-up:
	docker compose -f config/docker-compose.yml up -d --build

docker-down:
	docker compose -f config/docker-compose.yml down

docker-logs:
	docker compose -f config/docker-compose.yml logs -f bb-mcp

docker-doctor:
	docker compose -f config/docker-compose.yml run --rm bb-mcp node dist/index.js --doctor

docker-probe:
	docker compose -f config/docker-compose.yml run --rm bb-mcp node dist/index.js --probe

docker-manifest:
	docker compose -f config/docker-compose.yml run --rm bb-mcp node dist/index.js --manifest

docker-tools:
	docker compose -f config/docker-compose.yml run --rm bb-mcp node dist/index.js --tools

# Validates the stdio transport against the official MCP Inspector CLI
# (tools/list over a real stdio handshake). Uses the `test` build target,
# which already runs `npm run build`, and a placeholder-credential config
# (config/mcp-inspector.config.example.json) — Inspector only needs
# *some* non-empty BB_CLIENT_ID/BB_CLIENT_SECRET to satisfy config.ts's
# startup check; no live Blackboard connection is required to validate the
# transport/protocol/schema layer this target checks.
docker-inspect:
	docker build --target test -t bb-mcp:test .
	docker run --rm bb-mcp:test npx --no-install @modelcontextprotocol/inspector --cli --config config/mcp-inspector.config.example.json --server bb-mcp --method tools/list --strict
