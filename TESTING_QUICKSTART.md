# B-Road Test Suite - Quick Start Guide

## TL;DR

```bash
# 1. Set up environment
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

# 2. Set up test database
createdb curvature_test
psql curvature_test -c "CREATE EXTENSION postgis;"

# 3. Run tests
pytest --cov

# 4. View coverage
open htmlcov/index.html
```

## What Was Built

**160+ tests** covering:
- ✅ Database models and PostGIS geometry
- ✅ Spatial queries (ST_Intersects, ST_Length, etc.)
- ✅ API endpoints (routes, sessions, curvature, tiles)
- ✅ GPX and KML export formats
- ✅ Route validation and statistics
- ✅ Vector tile generation and tile math
- ✅ Curvature data processing API

**Target:** 70-80% code coverage

## First-Time Setup (5 minutes)

### 1. Install Dependencies
```bash
cd api

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install packages
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 2. Database Setup
```bash
# Create test database (one-time)
createdb curvature_test

# Enable PostGIS
psql curvature_test -c "CREATE EXTENSION postgis;"

# Verify
psql curvature_test -c "SELECT PostGIS_Version();"
```

### 3. Run Tests
```bash
# Full test suite (~20 seconds)
pytest

# With coverage report
pytest --cov --cov-report=html

# View in browser
open htmlcov/index.html  # macOS
# or
xdg-open htmlcov/index.html  # Linux
# or
start htmlcov/index.html  # Windows
```

## Daily Workflow

### Running Tests
```bash
# Fast unit tests only
pytest -m unit

# Integration tests
pytest -m integration

# Specific file
pytest tests/unit/test_models.py -v

# Stop on first failure
pytest -x

# Verbose output
pytest -vv
```

### Before Committing
```bash
# Run full suite with coverage
pytest --cov --cov-fail-under=70

# If coverage fails, check report
pytest --cov --cov-report=term-missing

# Format code
black .

# Lint code
ruff check .
```

## Troubleshooting

### "PostgreSQL connection failed"
```bash
# Start PostgreSQL
brew services start postgresql  # macOS
sudo service postgresql start   # Linux

# Verify it's running
pg_isready
```

### "PostGIS not found"
```bash
# Install PostGIS
brew install postgis  # macOS
sudo apt install postgis  # Ubuntu

# Enable in database
psql curvature_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### "Module not found: models"
```bash
# Make sure you're in api/ directory
cd api

# Verify Python can import
python -c "import models"
```

### "Test database already exists"
```bash
# The test suite auto-manages the database
# But if you need to reset manually:
dropdb curvature_test
createdb curvature_test
psql curvature_test -c "CREATE EXTENSION postgis;"
```

## Understanding Test Results

### Success Output
```
tests/unit/test_models.py::TestRouteSession::test_route_session_creation PASSED [ 1%]
tests/unit/test_models.py::TestSavedRoute::test_saved_route_with_geometry PASSED [ 2%]
...
======================== 164 passed in 22.34s =========================

---------- coverage: platform darwin, python 3.9.7 -----------
Name                              Stmts   Miss  Cover
-----------------------------------------------------
...
-----------------------------------------------------
TOTAL                               xxx    xxx    xx%
```
> Note: Run `pytest --cov` to see your actual coverage numbers.

### Failure Output
```
FAILED tests/unit/test_models.py::TestSavedRoute::test_url_slug_unique

E   sqlalchemy.exc.IntegrityError: (psycopg2.errors.UniqueViolation)
E   duplicate key value violates unique constraint "saved_routes_url_slug_key"
```

## Next Steps

### 1. Review Coverage
```bash
# Generate detailed coverage report
pytest --cov --cov-report=html

# Open in browser
open htmlcov/index.html

# Look for red/yellow highlighted lines
# These are uncovered code paths
```

### 2. Push and Verify CI
```bash
# Tests run automatically on GitHub Actions for pushes to
# main, master, feature/*, and develop branches
git push

# CI runs the full test suite with coverage and linting
```

## Common Test Commands Reference

```bash
# Basic
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest -x                       # Stop on first failure
pytest -k "test_route"         # Run tests matching "test_route"

# Coverage
pytest --cov                    # Show coverage
pytest --cov --cov-report=html  # Generate HTML report
pytest --cov-fail-under=70      # Fail if <70% coverage

# Markers
pytest -m unit                  # Run unit tests only
pytest -m integration           # Run integration tests only
pytest -m spatial               # Run spatial tests only
pytest -m "not slow"           # Skip slow tests

# Specific tests
pytest tests/unit/              # All unit tests
pytest tests/unit/test_models.py  # One file
pytest tests/unit/test_models.py::TestRouteSession  # One class
pytest tests/unit/test_models.py::TestRouteSession::test_route_session_creation  # One test

# Re-running
pytest --lf                     # Run last failed tests
pytest --ff                     # Run failures first

# Output
pytest -s                       # Show print statements
pytest -vv                      # Very verbose
pytest --tb=short              # Shorter tracebacks
```

## Test Organization

```
api/tests/
├── conftest.py              ← Pytest configuration & fixtures
├── unit/                    ← Fast tests (~2-5 seconds)
│   ├── test_models.py           → Database models
│   ├── test_database.py         → DB connections
│   ├── test_validation.py       → Validation logic
│   └── test_tile_math.py        → Tile coordinate calculations
│
├── integration/             ← Slower tests (~10-20 seconds)
│   ├── test_spatial_queries.py  → PostGIS functions
│   ├── test_api_routes.py       → API endpoints
│   ├── test_export.py           → GPX/KML export
│   ├── test_curvature_api.py    → Curvature processing API
│   └── test_tile_endpoint.py    → Vector tile endpoint
│
└── fixtures/                ← Test data
    ├── sample_segments.py       → Sample routes
    └── curvature_fixtures.py    → Curvature test data
```

## Getting Help

### Test Documentation
- **Full guide:** `api/tests/README.md`
- **This guide:** `TESTING_QUICKSTART.md`

### Resources
- [pytest docs](https://docs.pytest.org/)
- [PostGIS functions](https://postgis.net/docs/reference.html)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)

### Common Issues
1. **PostgreSQL not running** → `brew services start postgresql`
2. **PostGIS missing** → `brew install postgis`
3. **Import errors** → Make sure you're in `api/` directory
4. **Coverage too low** → Check `htmlcov/index.html` for uncovered lines

## Success Checklist

Before merging your changes:

- [ ] All tests pass locally: `pytest`
- [ ] Coverage ≥70%: `pytest --cov`
- [ ] No linting errors: `ruff check .`
- [ ] Code formatted: `black --check .`
- [ ] CI passes on GitHub Actions
- [ ] Documentation reviewed

## Questions?

Check:
1. `api/tests/README.md` for detailed documentation
2. Test files for examples of test patterns
3. GitHub Issues for known problems

Happy testing! 🧪
