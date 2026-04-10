# B-Road

A web application for discovering and routing curvy roads. Built with a FastAPI backend, Next.js frontend, and PostGIS database.

## Project structure

```
api/            # FastAPI backend (Python 3.11)
  models/       # SQLAlchemy ORM models
  routers/      # API route handlers
  repositories/ # DB query layer
  services/     # Business logic
  tests/        # pytest (unit/ and integration/)
frontend/       # Next.js app (TypeScript, Tailwind)
  app/          # App router pages (planner, my-routes, etc.)
  components/   # React components
  store/        # Zustand stores
  hooks/        # Custom React hooks
docker/         # Dockerfiles for api and frontend
curvature/      # Curvature data processing pipeline
scripts/        # Data processing and utility scripts
data/           # OSRM routing data and backups (gitignored)
```

## Running the app

```bash
docker compose up -d              # Start all services
docker compose up -d --build      # Rebuild after Dockerfile/requirements.txt changes
```

Source code is bind-mounted — no restart needed for code changes.

## Testing

### Backend (runs inside Docker)

```bash
# All tests
docker compose exec -w /app/api \
  -e TEST_DB_HOST=db \
  -e TEST_DB_USER=curvature \
  -e TEST_DB_PASSWORD=curvature_dev_password \
  -e TEST_DB_NAME=curvature_test \
  api python -m pytest --no-cov -v

# Unit tests only (no DB needed)
docker compose exec -w /app/api api python -m pytest tests/unit/ --no-cov -v

# Single file
docker compose exec -w /app/api api python -m pytest tests/unit/test_query_builder.py --no-cov -v
```

Coverage target: 60% fail-under, 70-80% goal. Use `--no-cov` for quick local runs.

### Frontend

```bash
cd frontend && npx tsc --noEmit   # Type check
cd frontend && npm run lint       # ESLint
cd frontend && npm run build      # Full build check
```

## Linting & formatting

### Backend

```bash
# Inside Docker
docker compose exec -w /app/api api ruff check .
docker compose exec -w /app/api api black --check --diff .
```

### Frontend

```bash
cd frontend && npm run lint
```

## Database safety

- **NEVER run `docker compose down -v`** or drop/recreate the DB. The `curvature_segments` table has 2.1M rows that take ~5 hours to regenerate.
- **Schema changes**: Always use `ALTER TABLE ADD COLUMN` — never recreate tables.
- **ORM model changes**: After modifying `api/models/orm.py`, provide the corresponding `ALTER TABLE` SQL.
- **Before any DB-destructive action**: Always ask the user first.

## Docker workflow

- **`.env` or compose config changed**: `docker compose up -d` (recreates affected containers)
- **Dockerfile/requirements changed**: `docker compose up -d --build`
- **Source code**: Live via bind mounts, no action needed
- **New npm package**: Run `npm install <pkg>` locally in `frontend/`, then `docker compose up -d`
- **`docker compose restart` does NOT pick up `.env` or compose changes** — always use `up -d`

## Workflow preferences

- Always commit after each completed step before moving on to the next
- Always verify values against source code — plans and memory may contain outdated data
- Before editing a component, grep for its imports to confirm it's actually used on the target page
- Keep documentation up to date after changes to the codebase
