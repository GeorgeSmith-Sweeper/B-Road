# B-Road Technical Debt Plan

**Branch**: `chore/clean-up-debt`
**Created**: 2026-03-05
**Strategy**: Small, focused commits — one task per agent session for easy audit/revert.

---

## Phase 1: Dead Code Removal

Low-risk cleanup. Remove files and code that are no longer used.

### Task 1.1 — Remove duplicate `api/models.py`
- **File**: `api/models.py` (150 lines)
- **Why**: Duplicate of `api/models/orm.py`. Missing newer fields (`user_id`, `road_rating`, `connecting_geometry`, `route_type`, `RouteWaypoint`).
- **Action**: Delete `api/models.py`. Update any imports that reference it (check `api/export_service.py:22`, `api/test_export_service.py:18`).
- **Commit**: `chore: remove duplicate api/models.py in favor of models/orm.py`

### Task 1.2 — Remove duplicate `api/export_service.py`
- **File**: `api/export_service.py` (369 lines)
- **Why**: Duplicate of `api/services/export_service.py`. Routers import from `services/`, so root-level copy is unused.
- **Action**: Delete `api/export_service.py`. Verify no imports reference it.
- **Commit**: `chore: remove duplicate api/export_service.py`

### Task 1.3 — Remove misplaced `api/test_export_service.py`
- **File**: `api/test_export_service.py` (296 lines)
- **Why**: Located in root of `api/` instead of `api/tests/`. Imports from wrong path (`from api.export_service`). Duplicate test coverage exists in `api/tests/unit/test_export_endpoints.py`.
- **Action**: Delete `api/test_export_service.py`. Verify test suite still passes.
- **Commit**: `chore: remove misplaced test_export_service.py`

### Task 1.4 — Remove unused `require_session_id` function
- **File**: `api/routers/routes.py:60`
- **Why**: Defined but never called anywhere. `get_auth_context()` is used instead.
- **Action**: Delete the function definition (lines 60-64).
- **Commit**: `chore: remove unused require_session_id from routes.py`

### Task 1.5 — Remove empty `api/config.py` stub
- **File**: `api/config.py`
- **Why**: Empty stub file (~5 lines with comment). Not imported anywhere. `api/config.example.py` exists but is also unused.
- **Action**: Delete `api/config.py` and `api/config.example.py`.
- **Commit**: `chore: remove unused config stub files`

---

## Phase 2: Bug Fixes

Fix known bugs documented in project memory and discovered during audit.

### Task 2.1 — Fix broad exception handling in `chat.py` (swallows HTTPException)
- **File**: `api/routers/chat.py` — lines 43, 73
- **Bug**: `/chat/test` and `/chat/extract-filters` catch `Exception` which swallows `HTTPException(503)` from `get_claude_service()` and re-wraps as 500.
- **Fix**: Add `except HTTPException: raise` before `except Exception` (matching the pattern already used in `/chat/search`).
- **Commit**: `fix: prevent chat endpoints from swallowing HTTPException as 500`

### Task 2.2 — Fix async/sync mismatch in `ClaudeService`
- **File**: `api/services/claude_service.py` — lines 103, 128, 196
- **Bug**: `send_message()`, `extract_filters()`, `generate_response()` are `async` but call synchronous `client.messages.create()`, blocking the event loop.
- **Fix**: Either use `anthropic.AsyncAnthropic` client, or wrap sync calls in `asyncio.to_thread()`, or remove `async` if callers don't need it.
- **Commit**: `fix: make ClaudeService methods truly async with AsyncAnthropic`

### Task 2.3 — Fix deprecated `onKeyPress` in ChatInterface
- **File**: `frontend/components/ChatInterface.tsx:256`
- **Bug**: `onKeyPress` is deprecated in React 18+.
- **Fix**: Replace with `onKeyDown` and adjust handler logic if needed.
- **Commit**: `fix: replace deprecated onKeyPress with onKeyDown in ChatInterface`

### Task 2.4 — Add error handling to clipboard API call
- **File**: `frontend/app/planner/page.tsx:269`
- **Bug**: `navigator.clipboard.writeText()` called without try-catch. Fails silently in some browser contexts.
- **Fix**: Wrap in try-catch, show error toast on failure.
- **Commit**: `fix: add error handling to clipboard writeText in share button`

---

## Phase 3: Non-Functional UI Elements

Fix or remove buttons that don't work.

### Task 3.1 — Remove non-functional "WATCH DEMO" button
- **File**: `frontend/app/page.tsx:174`
- **Issue**: Button has no `onClick` handler. No demo video exists.
- **Action**: Remove the button entirely. Can be re-added when demo is produced.
- **Commit**: `fix: remove non-functional WATCH DEMO button from landing page`

### Task 3.2 — Remove non-functional filter tabs on landing page
- **File**: `frontend/app/page.tsx:278-287`
- **Issue**: "ALL", "SCENIC", "MOUNTAIN", "COASTAL" buttons have no handlers. Road cards below are static.
- **Action**: Remove the filter tab row. The static cards remain as a showcase.
- **Commit**: `fix: remove non-functional filter tabs from featured roads section`

### Task 3.3 — Wire compass button to reset map bearing
- **File**: `frontend/components/Map.tsx:942`
- **Issue**: Compass icon button has no `onClick`.
- **Action**: Wire to `mapRef.current?.resetNorth()` (or `easeTo({ bearing: 0 })`).
- **Commit**: `feat: wire compass button to reset map bearing to north`

### Task 3.4 — Improve "ADD" button behavior
- **File**: `frontend/app/planner/page.tsx:161-167`
- **Issue**: Only shows a toast. Users expect it to do something.
- **Action**: Either open the address search bar, or restyle as a help/info icon instead of a primary "ADD" button.
- **Commit**: `fix: make ADD button open address search instead of just showing toast`

---

## Phase 4: Exception Handling Cleanup

Replace broad `except Exception` with specific exceptions across the backend.

### Task 4.1 — Fix exception handling in `routes.py`
- **File**: `api/routers/routes.py` — 10 occurrences (lines 85, 113, 140, 160, 186, 207, 237, 264, 286, 305)
- **Action**: Add `except HTTPException: raise` before each `except Exception`. Log the actual exception type for debugging.
- **Commit**: `fix: prevent routes.py from swallowing HTTPException errors`

### Task 4.2 — Fix exception handling in `curvature.py`
- **File**: `api/routers/curvature.py` — 5 occurrences (lines 102, 121, 155, 183, 210)
- **Action**: Same pattern — re-raise HTTPException, catch specific DB/validation errors.
- **Commit**: `fix: refine exception handling in curvature.py`

### Task 4.3 — Fix exception handling in `database.py`
- **File**: `api/database.py` — 5 occurrences (lines 53, 74, 94, 111, 129)
- **Action**: Catch specific `psycopg2` / `sqlalchemy` exceptions. Let unexpected errors propagate.
- **Commit**: `fix: use specific exception types in database.py`

### Task 4.4 — Fix exception handling in `claude_service.py`
- **File**: `api/services/claude_service.py` — 4 occurrences (lines 124, 192, 247, 260)
- **Action**: Catch `anthropic.APIError` and subclasses. Let unexpected errors propagate.
- **Commit**: `fix: catch specific Anthropic API errors in claude_service.py`

### Task 4.5 — Fix exception handling in remaining files
- **Files**: `tiles.py:78`, `sessions.py:33`, `geometry_service.py:59`, `export_service.py:167`
- **Action**: Replace broad catches with specific exceptions per file. Note: `geometry_service.py:59` silently swallows with `except Exception: continue` — add logging.
- **Commit**: `fix: refine exception handling in tiles, sessions, geometry, export`

---

## Phase 5: Frontend Code Quality

### Task 5.1 — Replace `console.error` with proper error handling
- **Files**:
  - `frontend/hooks/useClaimRoutes.ts:34`
  - `frontend/components/Map.tsx:565,843,868`
  - `frontend/app/planner/page.tsx:78,97`
- **Action**: Replace `console.error` with user-visible error states or toast notifications. Use a logger utility if needed for dev-only output.
- **Commit**: `fix: replace console.error with user-facing error handling`

### Task 5.2 — Add TypeScript interfaces for loose types
- **Files**:
  - `frontend/lib/api.ts:154` — `Promise<unknown>` return type
  - `frontend/lib/routes-api.ts:76,78,102` — `Record<string, unknown>` usage
  - `frontend/lib/chat-api.ts:14` — untyped filters
  - `frontend/components/Map.tsx:155` — `Record<string, unknown>` props
- **Action**: Define proper interfaces (`CurvatureSegmentDetail`, `RouteSegment`, `ChatFilters`, `EVStationProps`) and replace loose types.
- **Commit**: `refactor: add TypeScript interfaces for API response types`

### Task 5.3 — Extract hardcoded map constants
- **File**: `frontend/components/Map.tsx`
- **Issue**: Hardcoded Mapbox style URLs (lines 21-25), curvature color values (lines 232-263), popup CSS (lines 38-63), magic numbers (`EV_FETCH_MIN_ZOOM = 8`, `EV_DEBOUNCE_MS = 500`).
- **Action**: Move to a `lib/map-constants.ts` config file.
- **Commit**: `refactor: extract hardcoded map constants to config file`

### Task 5.4 — Centralize `API_BASE_URL` definition
- **Files**: 5 files all duplicate `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`
  - `frontend/lib/api.ts:10`
  - `frontend/lib/chat-api.ts:5`
  - `frontend/lib/routes-api.ts:5`
  - `frontend/lib/routing-api.ts:7`
  - `frontend/components/Map.tsx:19`
- **Action**: Create `frontend/lib/config.ts` exporting `API_BASE_URL`. Update all 5 files to import from it.
- **Commit**: `refactor: centralize API_BASE_URL into shared config`

### Task 5.5 — Extract duplicate error-handling pattern in `routes-api.ts`
- **File**: `frontend/lib/routes-api.ts` — 7 occurrences of `.catch(() => ({ detail: 'Unknown error' }))`
- **Action**: Extract to a shared `parseErrorResponse(response)` utility. Apply to `routes-api.ts`, `routing-api.ts`, and `chat-api.ts`.
- **Commit**: `refactor: extract shared API error parsing utility`

---

## Phase 6: Infrastructure & CI/CD

### Task 6.1 — ✅ Fix Makefile lint command (flake8 -> ruff)
- **File**: `Makefile:93`
- **Issue**: References `flake8` which isn't installed. Project uses `ruff`.
- **Action**: Replace `python -m flake8 api/ || true` with `ruff check api/`.
- **Commit**: `fix: update Makefile lint target from flake8 to ruff`

### Task 6.2 — ✅ Consolidate requirements files
- **Files**: `api/requirements.txt`, `api/requirements-dev.txt`, `api/requirements-test.txt`
- **Issue**: `requirements-dev.txt` doesn't include `-r requirements.txt`. Test deps duplicated across files.
- **Action**: Make `requirements-dev.txt` start with `-r requirements.txt`, merge test deps into dev, remove `requirements-test.txt`.
- **Commit**: `chore: consolidate Python requirements files`

### Task 6.3 — ✅ Add frontend checks to CI/CD
- **File**: `.github/workflows/test.yml`
- **Issue**: Only runs backend tests. No frontend type checking, linting, or build verification.
- **Action**: Add a `frontend` job that runs `npm ci`, `npx tsc --noEmit`, and `npm run build`.
- **Commit**: `ci: add frontend type check and build to test workflow`

### Task 6.4 — ✅ Add ESLint configuration for frontend (already existed)
- **Missing file**: `frontend/eslint.config.mjs` (ESLint 9 flat config)
- **Issue**: ESLint 9 + eslint-config-next are installed but no config file exists. `npm run lint` does nothing useful.
- **Action**: Create ESLint flat config with Next.js and TypeScript rules.
- **Commit**: `chore: add ESLint configuration for frontend`

### Task 6.5 — ✅ Add `.dockerignore` file (already existed)
- **Missing file**: `.dockerignore`
- **Issue**: Docker builds include unnecessary files (`.git`, `__pycache__`, `.pytest_cache`, `node_modules`, `.next`, `.claude/`).
- **Action**: Create `.dockerignore` with standard exclusions.
- **Commit**: `chore: add .dockerignore to reduce build context size`

### Task 6.6 — ✅ Replace `print()` with logging in backend
- **Files**:
  - `api/database.py:142-158` — print statements in `__main__` block
  - `api/server.py:36,69-70` — print statements for warnings
- **Action**: Replace with `logging.getLogger(__name__)` calls at appropriate levels.
- **Commit**: `refactor: replace print statements with logging in backend`

---

## Phase 7: Documentation Updates

### Task 7.1 — Update README.md tech stack version
- **File**: `README.md:87`
- **Issue**: Says "Next.js 14" but project uses Next.js 16.1.1.
- **Action**: Update to "Next.js 16".
- **Commit**: `docs: update README tech stack to reflect Next.js 16`

### Task 7.2 — Update `.env.example` with all required variables
- **File**: `.env.example`
- **Issue**: Missing some variables used in compose/code. Duplicate `api/.env` causes confusion.
- **Action**: Add all env vars with comments. Document that `api/.env` is redundant when using Docker Compose.
- **Commit**: `docs: complete .env.example with all required variables`

---

## Phase 8: Security Hardening

### Task 8.1 — Replace `crypto.randomUUID()` fallback with `nanoid`
- **File**: `frontend/store/useWaypointRouteStore.ts:6-13`
- **Issue**: Math.random UUID v4 fallback for non-HTTPS is cryptographically weak.
- **Action**: Install `nanoid` and replace `generateId()` helper entirely.
- **Commit**: `fix: replace Math.random UUID fallback with nanoid`

---

## Execution Order (Recommended)

Priority groups — work through in order, but tasks within a group can run in parallel:

| Priority | Tasks | Risk | Rationale |
|----------|-------|------|-----------|
| 1 - Immediate | 1.1, 1.2, 1.3, 1.4, 1.5 | Low | Dead code removal. No behavior change. |
| 2 - High | 2.1, 2.2, 2.3, 2.4 | Medium | Bug fixes affecting correctness. |
| 3 - High | 4.1, 4.2, 4.3, 4.4, 4.5 | Medium | Exception handling across backend. |
| 4 - Medium | 3.1, 3.2, 3.3, 3.4 | Low | UI fixes for non-functional buttons. |
| 5 - Medium | 5.1, 5.2, 5.3, 5.4, 5.5 | Low | Frontend code quality. |
| 6 - Medium | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 | Low | Infra/CI improvements. |
| 7 - Low | 7.1, 7.2 | Low | Documentation accuracy. |
| 8 - Low | 8.1 | Medium | Security hardening. |

---

## Summary

**Total**: 30 tasks across 8 phases.
Each task = 1 focused agent session = 1 small commit.

| Phase | Count | Description |
|-------|-------|-------------|
| 1 — Dead Code | 5 | Remove duplicate/unused files and functions |
| 2 — Bug Fixes | 4 | Fix known bugs (HTTPException, async, deprecated API, clipboard) |
| 3 — Non-Functional UI | 4 | Fix/remove dead buttons |
| 4 — Exception Handling | 5 | Replace 33 broad `except Exception` catches |
| 5 — Frontend Quality | 5 | Types, constants, deduplication |
| 6 — Infra/CI | 6 | Makefile, requirements, CI, ESLint, Docker, logging |
| 7 — Documentation | 2 | README, .env.example |
| 8 — Security | 1 | nanoid replacement |
