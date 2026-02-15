# B-Road API Test Suite

Comprehensive test suite for the B-Road backend API with 70-80% code coverage target.

## Test Structure

```
api/tests/
├── __init__.py
├── conftest.py              # Shared fixtures and test configuration
├── README.md                # This file
├── unit/                    # Unit tests (fast, isolated)
│   ├── test_models.py       # SQLAlchemy model tests
│   ├── test_database.py     # Database connection tests
│   ├── test_validation.py   # Route validation logic tests
│   ├── test_routing.py      # OSRM routing service tests
│   └── test_curvy_routing.py # Curvy route finder scoring/selection tests
├── integration/             # Integration tests (slower, real DB)
│   ├── test_spatial_queries.py  # PostGIS spatial operations
│   ├── test_api_routes.py       # API endpoint tests
│   ├── test_export.py           # GPX/KML export tests
│   └── test_corridor_query.py   # Corridor spatial query tests
└── fixtures/                # Test data
    ├── sample_segments.py   # Sample route and segment data
    ├── curvature_fixtures.py # Curvature pipeline test data
    └── __init__.py
```

## Test Coverage

### Unit Tests (Fast, ~0.1s per test)
- **test_models.py**: 24 tests
  - RouteSession CRUD and relationships
  - SavedRoute geometry handling
  - RouteSegment cascade deletes
  - Model validation and constraints

- **test_database.py**: 13 tests
  - PostgreSQL connection management
  - PostGIS extension availability
  - Spatial indexes and constraints
  - Database initialization

- **test_validation.py**: 16 tests
  - Route statistics calculations
  - Segment connectivity validation
  - Coordinate bounds checking
  - LineString construction
  - Data integrity checks

- **test_curvy_routing.py**: 23 tests
  - CurvyRouteOptions/Request/Response model validation
  - Segment scoring algorithm (curvature/length/proximity weighting)
  - Segment selection with spacing constraints
  - Waypoint list construction
  - Full route finding with mocked OSRM and repository
  - Detour trimming when ratio exceeds threshold
  - Short route corridor reduction

### Integration Tests (Slower, ~0.5-1s per test)
- **test_spatial_queries.py**: 17 tests
  - ST_Intersects for segment connectivity
  - ST_Length for distance calculations
  - Bounding box queries
  - Geometry validation
  - GIST spatial indexes

- **test_api_routes.py**: 30+ tests
  - Session management endpoints
  - Route CRUD operations
  - URL slug generation
  - Public/private routes
  - Error handling
  - Concurrent operations

- **test_export.py**: 22 tests
  - GPX format generation and validation
  - KML format generation and validation
  - Coordinate precision
  - Special character handling
  - Format comparison

- **test_corridor_query.py**: 9 tests
  - Corridor buffer spatial query (ST_DWithin with geography)
  - Route position ordering (ST_LineLocatePoint)
  - Min curvature and min length filtering
  - Paved-only filtering
  - Empty results for distant routes
  - Limit and sort order validation
  - Centroid coordinate validation

**Total**: ~350 tests covering all critical paths

## Setup

### 1. Install Dependencies

```bash
# From api/ directory
cd api

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install production dependencies
pip install -r requirements.txt

# Install test dependencies
pip install -r requirements-dev.txt
```

### 2. Set Up Test Database

```bash
# Create test database
createdb curvature_test

# Enable PostGIS extension
psql curvature_test -c "CREATE EXTENSION postgis;"
```

**Note**: The test suite automatically creates/drops the test database for each test session using pytest-postgresql, but you need PostgreSQL running locally.

### 3. Configure Environment Variables (Optional)

```bash
export TEST_DB_NAME=curvature_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
```

## Running Tests

### Run All Tests
```bash
cd api
pytest
```

### Run Specific Test Categories
```bash
# Unit tests only (fast)
pytest -m unit

# Integration tests only
pytest -m integration

# Spatial tests only
pytest -m spatial

# Exclude slow tests
pytest -m "not slow"
```

### Run Specific Test Files
```bash
# Test models
pytest tests/unit/test_models.py -v

# Test API routes
pytest tests/integration/test_api_routes.py -v

# Test spatial queries
pytest tests/integration/test_spatial_queries.py -v
```

### Run with Coverage
```bash
# Generate coverage report
pytest --cov --cov-report=html

# View coverage report
open htmlcov/index.html

# Fail if coverage below 70%
pytest --cov --cov-fail-under=70
```

### Run Specific Tests
```bash
# Single test by name
pytest tests/unit/test_models.py::TestRouteSession::test_route_session_creation -v

# All tests in a class
pytest tests/unit/test_models.py::TestSavedRoute -v
```

## Test Database Management

The test suite uses **pytest-postgresql** which:
- Creates a fresh test database for each test session
- Enables PostGIS extension automatically
- Drops the database after tests complete
- Provides transaction isolation between tests

Each test function gets:
- **test_db_session**: Fresh database session with automatic rollback
- **test_engine**: SQLAlchemy engine connected to test DB
- **test_client**: FastAPI TestClient with overridden dependencies

## Key Fixtures

### Database Fixtures
- **postgresql_proc**: Test database process (session-scoped)
- **test_engine**: SQLAlchemy engine (session-scoped)
- **test_db_session**: Database session with rollback (function-scoped)
- **test_client**: FastAPI TestClient (function-scoped)
- **verify_postgis**: Verify PostGIS availability

### Data Fixtures
- **sample_session**: RouteSession for testing
- **sample_route**: SavedRoute with 3 connected segments
- **sample_segments**: List of RouteSegment objects
- **clean_database**: Empty database for tests

### Test Data
- **CONNECTED_SEGMENTS**: Valid route with 3 connected segments
- **DISCONNECTED_SEGMENTS**: Invalid route with gap
- **SINGLE_SEGMENT**: Minimal route with 1 segment
- **LONG_ROUTE_SEGMENTS**: 100 segments for performance testing

## Expected Coverage

Target: **70-80% code coverage**

### Coverage by Module (Expected)
- `api/models.py`: 90%+ (straightforward ORM models)
- `api/database.py`: 80%+ (connection management)
- `api/server.py`: 70%+ (main API logic, some error paths untested)

### Uncovered Areas (Acceptable <70%)
- Error recovery code paths
- Some edge cases in data loading
- Optional features (e.g., elevation data not implemented)

## CI/CD Integration

The test suite runs automatically on GitHub Actions for:
- All pushes to `main`, `master`, `develop` branches
- All pushes to feature branches (`feature/*`)
- All pull requests

### GitHub Actions Workflow

Located at `.github/workflows/test.yml`:
- Runs PostgreSQL + PostGIS in Docker container
- Installs Python 3.11 and dependencies
- Runs pytest with coverage reporting
- Uploads coverage to Codecov
- Fails if coverage drops below 70%

### Viewing Test Results

GitHub Actions provides:
- ✅ Test pass/fail status on PRs
- 📊 Coverage reports via Codecov
- 📝 Detailed logs for debugging failures

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Check if test database exists
psql -l | grep curvature_test

# Manually create test database
createdb curvature_test
psql curvature_test -c "CREATE EXTENSION postgis;"
```

### PostGIS Extension Missing

```bash
# Install PostGIS (Ubuntu/Debian)
sudo apt-get install postgis postgresql-15-postgis-3

# Install PostGIS (macOS with Homebrew)
brew install postgis

# Enable in database
psql curvature_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Import Errors

```bash
# Make sure you're in the api/ directory
cd api

# Verify dependencies are installed
pip list | grep pytest

# Reinstall if needed
pip install -r requirements-dev.txt
```

### Test Database Permissions

```bash
# Grant permissions to test user
psql -c "GRANT ALL PRIVILEGES ON DATABASE curvature_test TO test;"
```

### Fixture Errors

```python
# If you get "fixture not found" errors, check:
# 1. Fixture is defined in conftest.py
# 2. You're using correct fixture name
# 3. Import paths are correct
```

## Writing New Tests

### Test File Naming
- Unit tests: `tests/unit/test_*.py`
- Integration tests: `tests/integration/test_*.py`
- Test functions: `def test_*():`
- Test classes: `class Test*:`

### Using Fixtures

```python
import pytest

def test_something(test_db_session, sample_route):
    """Test docstring explaining what this tests."""
    # Arrange
    expected_value = 42

    # Act
    result = sample_route.some_method()

    # Assert
    assert result == expected_value
```

### Markers

```python
@pytest.mark.unit
def test_fast_unit_test():
    """Fast isolated test."""
    assert 1 + 1 == 2

@pytest.mark.integration
@pytest.mark.spatial
def test_postgis_query(test_db_session):
    """Integration test requiring database."""
    result = test_db_session.execute(text("SELECT PostGIS_Version()"))
    assert result is not None

@pytest.mark.slow
def test_performance(test_db_session):
    """Slow test (>5 seconds)."""
    # Create 1000 records and test performance
    pass
```

## Test Quality Standards

### Good Test Characteristics
- ✅ **Fast**: Unit tests <100ms, integration tests <1s
- ✅ **Isolated**: No dependencies on other tests
- ✅ **Repeatable**: Same result every time
- ✅ **Self-checking**: Clear pass/fail with assertions
- ✅ **Comprehensive**: Cover happy path + edge cases

### Test Documentation
- Clear test names that describe what is tested
- Docstrings explaining the test's purpose
- Comments for non-obvious test logic
- Arrange-Act-Assert structure

### Example: Well-Written Test

```python
@pytest.mark.integration
@pytest.mark.spatial
def test_route_geometry_stored_correctly(test_db_session, sample_session):
    """
    Test that LineString geometry is stored and retrieved from PostGIS.

    This verifies:
    1. GeoAlchemy2 correctly converts Shapely LineString to PostGIS geometry
    2. SRID 4326 (WGS84) is preserved
    3. Coordinate precision is maintained
    """
    # Arrange: Create LineString with known coordinates
    linestring = LineString([(-72.575, 44.260), (-72.580, 44.265)])

    route = SavedRoute(
        session_id=sample_session.session_id,
        route_name="Geometry Test",
        total_curvature=10.0,
        total_length=500.0,
        segment_count=1,
        geom=from_shape(linestring, srid=4326),
        url_slug="geom-test"
    )

    # Act: Save and retrieve from database
    test_db_session.add(route)
    test_db_session.commit()
    test_db_session.refresh(route)

    # Assert: Geometry is correct
    retrieved_shape = to_shape(route.geom)
    assert isinstance(retrieved_shape, LineString)
    assert len(retrieved_shape.coords) == 2
    assert retrieved_shape.coords[0] == pytest.approx((-72.575, 44.260))
```

## Performance Benchmarks

Expected test run times on modern hardware:
- **Unit tests**: ~2-5 seconds (50+ tests)
- **Integration tests**: ~10-20 seconds (75+ tests)
- **Full suite**: ~15-25 seconds (125+ tests)
- **With coverage**: +5-10 seconds overhead

Slow tests (>5s) are marked with `@pytest.mark.slow`.

## Contributing

When adding new code:
1. Write tests first (TDD) or alongside code
2. Aim for 70%+ coverage on new code
3. Run tests locally before committing
4. Fix any failing tests in CI

## References

- [pytest documentation](https://docs.pytest.org/)
- [pytest-postgresql](https://pypi.org/project/pytest-postgresql/)
- [PostGIS documentation](https://postgis.net/documentation/)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [GeoAlchemy2](https://geoalchemy-2.readthedocs.io/)
