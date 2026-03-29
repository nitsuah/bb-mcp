# Makefile for bb-mcp: Docker, test, lint, build

.PHONY: all test lint build docker-test docker-build

all: test

test:
	npm test

lint:
	npm run lint

build:
	npm run build

docker-test:
	docker build --no-cache -t bb-mcp:ci .
	docker run --rm -it bb-mcp:ci npm test

docker-build:
	docker build -t bb-mcp:latest .
