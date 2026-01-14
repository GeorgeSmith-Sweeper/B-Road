## Summary

Integration tests are failing in CI after backend refactor. The test suite has 39 failures and requires investigation into dependency injection, fixture setup, and test assertions.

**Type:** Bug / Test Infrastructure
**Priority:** High
**Assignee:** Testing Specialist
**Sprint:** 1
**Branch:** `feature/route-stitching`

---

## CI Run Reference

- **Run ID:** 21002481341
- **Status:** 39 failed, 82 passed
- **Coverage:** 64% (below 70% threshold)

---

## Failure Categories

### Category 1: Dependency Injection / Database Session (Critical - 16 tests)

**Symptoms:**
- Routes returning 404 when they should exist
- "Session not found" errors
- Empty route lists when routes were created

**Affected Tests:**
```
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_save_route - 404
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_get_route_by_slug - 404
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_get_route_by_id - 404
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_list_routes - empty list
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_delete_route - 404
tests/integration/test_api_routes.py::TestRouteDataValidation::test_save_route_calculates_statistics - 404
tests/integration/test_api_routes.py::TestPublicRoutes::test_save_public_route - 404
tests/integration/test_api_routes.py::TestURLSlugGeneration::test_url_slug_generated - Session not found
tests/integration/test_api_routes.py::TestURLSlugGeneration::test_route_accessible_by_slug - 404
tests/integration/test_api_routes.py::TestConcurrentOperations::test_multiple_sessions_isolated - empty
```

**Root Cause Investigation:**

The `conftest.py` overrides `get_db_session` but the override may not be applying correctly:

```python
# conftest.py line 176
app.dependency_overrides[get_db_session] = override_get_db_session
```

**Possible Issues:**
1. Import path mismatch - `database.get_db_session` vs `api.database.get_db_session`
2. The `test_db_session` fixture creates data but TestClient makes separate requests that don't see uncommitted transactions
3. Session isolation between fixture setup and API requests

**Suggested Fix:**
Check if the dependency is being imported from the same module path that FastAPI uses. Consider using `app.dependency_overrides[api.database.get_db_session]` or investigating transaction visibility.

---

### Category 2: GPX/KML Export Parse Errors (15 tests)

**Symptoms:**
```
xml.etree.ElementTree.ParseError: not well-formed (invalid token): line 1, column 0
gpxpy.gpx.GPXXMLSyntaxException: Error parsing XML: not well-formed (invalid token)
```

**Affected Tests:**
```
tests/integration/test_export.py::TestGPXExport::* (8 tests)
tests/integration/test_export.py::TestKMLExport::* (7 tests)
tests/integration/test_export.py::TestExportComparison::* (2 tests)
tests/integration/test_export.py::TestExportEdgeCases::* (2 tests)
```

**Root Cause:**
These are downstream failures from Category 1. The export endpoints return 404 JSON responses instead of XML, which then fail to parse.

**Fix:** Resolving Category 1 should fix these automatically.

---

### Category 3: Request Validation Errors (4 tests)

**Symptoms:**
```
assert 422 == 200 (Unprocessable Entity)
assert 422 == 404
```

**Affected Tests:**
```
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_update_route - 422
tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_update_route_unauthorized - 422
tests/integration/test_api_routes.py::TestPublicRoutes::test_toggle_route_visibility - 422
```

**Root Cause:**
The tests may be sending request payloads that don't match the Pydantic schema expectations, OR the route doesn't exist (returning 404 before validation).

**Investigation Needed:**
- Check `UpdateRouteRequest` schema in `api/models/schemas.py`
- Verify test payloads match expected schema
- Determine if 422 is happening before or after route lookup

---

### Category 4: Spatial Query Assertions (2 tests)

**Symptoms:**
```
test_self_intersecting_linestring_detected - assert True is False
test_route_length_matches_geometry_length - 2052.44 != 1650.0 ± 160
```

**Affected Tests:**
```
tests/integration/test_spatial_queries.py::TestGeometryValidation::test_self_intersecting_linestring_detected
tests/integration/test_spatial_queries.py::TestDistanceCalculations::test_route_length_matches_geometry_length
```

**Root Cause:**
1. **Self-intersecting test:** PostGIS `ST_IsSimple()` may have different behavior than expected for the test geometry
2. **Length test:** The expected value (1650.0) doesn't match the actual PostGIS calculation (2052.44). Either:
   - The test data is wrong
   - The expected value needs updating
   - There's a units mismatch (meters vs degrees)

**Suggested Fix:**
- Review the test geometries and expected values
- Consider using `pytest.approx()` with larger tolerance if appropriate
- Verify ST_Length is using geography type for meter-based calculations

---

### Category 5: Missing Database Constraint (1 test)

**Symptom:**
```
test_route_segment_position_unique_per_route - Failed: DID NOT RAISE IntegrityError
```

**Affected Test:**
```
tests/unit/test_models.py::TestRouteSegment::test_route_segment_position_unique_per_route
```

**Root Cause:**
The test expects a unique constraint on `(route_id, position)` but the ORM model doesn't define one.

**Fix Options:**
1. Add `UniqueConstraint('route_id', 'position')` to `RouteSegment` model
2. Or update test to reflect actual (intended) behavior

---

### Category 6: Black Formatting (Lint Job)

**Symptom:**
```
error: Process completed with exit code 1
```

**Root Cause:**
Several files have formatting that doesn't match Black's style:
- Single quotes vs double quotes
- Line length issues
- Long assertion statements

**Fix:**
```bash
cd api && black .
```

---

## Files to Investigate

| File | Issue |
|------|-------|
| `api/tests/conftest.py` | Dependency injection override |
| `api/database.py` | `get_db_session` function |
| `api/models/schemas.py` | Pydantic request/response schemas |
| `api/models/orm.py` | SQLAlchemy models (missing constraints?) |
| `api/tests/integration/test_spatial_queries.py` | Geometry test assertions |

---

## Acceptance Criteria

- [ ] All 39 failing tests pass
- [ ] Coverage meets 70% threshold
- [ ] Black formatting check passes
- [ ] No regressions in previously passing tests

---

## Commands for Local Debugging

```bash
# Run specific failing test with verbose output
cd api
pytest tests/integration/test_api_routes.py::TestRouteCRUDOperations::test_save_route -v -s

# Run with SQL logging
DATABASE_URL=postgresql://... pytest -v -s --log-cli-level=DEBUG

# Check Black formatting
black --check --diff .

# Auto-fix Black formatting
black .
```

---

## Additional Context

- Backend was refactored from monolithic `server.py` to layered architecture
- Routers use `get_db_session` from `api.database`
- Tests were written expecting the refactored structure
- The dependency injection worked in the original monolith but broke during refactor
