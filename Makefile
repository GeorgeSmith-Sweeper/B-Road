# =============================================================================
# B-Road Makefile
# =============================================================================
# Common commands for Docker-based development
# =============================================================================

.PHONY: help up down build rebuild test lint coverage logs shell-api shell-db shell-frontend health prod-up prod-down prod-build clean

# Default target
help:
	@echo "B-Road Docker Commands"
	@echo "======================"
	@echo ""
	@echo "Development:"
	@echo "  make up              Start development environment"
	@echo "  make down            Stop development environment"
	@echo "  make build           Build Docker images"
	@echo "  make rebuild         Force rebuild Docker images (no cache)"
	@echo "  make logs            Show logs from all services"
	@echo "  make logs-api        Show API logs"
	@echo "  make logs-frontend   Show frontend logs"
	@echo "  make logs-db         Show database logs"
	@echo ""
	@echo "Testing:"
	@echo "  make test            Run API tests"
	@echo "  make lint            Run linters"
	@echo "  make coverage        Run tests with coverage report"
	@echo ""
	@echo "Debugging:"
	@echo "  make shell-api       Open shell in API container"
	@echo "  make shell-db        Open psql shell in database"
	@echo "  make shell-frontend  Open shell in frontend container"
	@echo "  make health          Check health of all services"
	@echo ""
	@echo "Production:"
	@echo "  make prod-build      Build production images"
	@echo "  make prod-up         Start production environment"
	@echo "  make prod-down       Stop production environment"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean           Remove containers, volumes, and images"
	@echo "  make clean-volumes   Remove only Docker volumes"

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------

up:
	docker compose up -d
	@echo ""
	@echo "Services starting..."
	@echo "  API:      http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Database: localhost:5432"
	@echo ""
	@echo "Run 'make health' to check status"
	@echo "Run 'make logs' to view logs"

down:
	docker compose down

build:
	docker compose build

rebuild:
	docker compose build --no-cache

# -----------------------------------------------------------------------------
# Logs
# -----------------------------------------------------------------------------

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-frontend:
	docker compose logs -f frontend

logs-db:
	docker compose logs -f db

# -----------------------------------------------------------------------------
# Testing
# -----------------------------------------------------------------------------

test:
	docker compose -f docker compose.test.yml up --build --abort-on-container-exit api-test
	docker compose -f docker compose.test.yml down -v

lint:
	docker compose exec api python -m flake8 api/ || true
	docker compose exec frontend npm run lint || true

coverage:
	docker compose -f docker compose.test.yml run --rm api-test pytest -v --cov=api --cov-report=html --cov-report=term-missing
	docker compose -f docker compose.test.yml down -v
	@echo "Coverage report generated in htmlcov/"

# -----------------------------------------------------------------------------
# Debugging
# -----------------------------------------------------------------------------

shell-api:
	docker compose exec api /bin/bash

shell-db:
	docker compose exec db psql -U $${POSTGRES_USER:-curvature} -d curvature

shell-frontend:
	docker compose exec frontend /bin/sh

health:
	@echo "Checking service health..."
	@echo ""
	@echo "Database:"
	@docker compose exec db pg_isready -U $${POSTGRES_USER:-curvature} -d curvature 2>/dev/null && echo "  ✓ PostgreSQL is ready" || echo "  ✗ PostgreSQL is not ready"
	@echo ""
	@echo "API:"
	@curl -sf http://localhost:8000/health >/dev/null 2>&1 && echo "  ✓ API is healthy" || echo "  ✗ API is not responding"
	@echo ""
	@echo "Frontend:"
	@curl -sf http://localhost:3000 >/dev/null 2>&1 && echo "  ✓ Frontend is healthy" || echo "  ✗ Frontend is not responding"
	@echo ""
	@echo "Container Status:"
	@docker compose ps

# -----------------------------------------------------------------------------
# Production
# -----------------------------------------------------------------------------

prod-build:
	docker compose -f docker compose.yml -f docker compose.prod.yml build

prod-up:
	docker compose -f docker compose.yml -f docker compose.prod.yml up -d
	@echo ""
	@echo "Production services starting..."
	@echo "Run 'make health' to check status"

prod-down:
	docker compose -f docker compose.yml -f docker compose.prod.yml down

# -----------------------------------------------------------------------------
# Maintenance
# -----------------------------------------------------------------------------

clean:
	docker compose down -v --rmi local --remove-orphans
	docker compose -f docker compose.test.yml down -v --rmi local --remove-orphans 2>/dev/null || true

clean-volumes:
	docker compose down -v
	docker compose -f docker compose.test.yml down -v 2>/dev/null || true
