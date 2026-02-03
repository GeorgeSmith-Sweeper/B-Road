# Plan: Load All 50 US States into PostGIS

## Status

**Updated: Feb 3, 2026**

- **Phase 1**: COMPLETE - Download failures were transient network issues (Jan 20). Downloads work fine now.
- **Phase 2**: COMPLETE - Delaware processed successfully (5,908 segments).
- **Phase 3**: COMPLETE - Virginia processed successfully (81,289 segments). Scaling estimates updated.
- **Phase 4**: READY - Full batch run can proceed.

**Current DB state**: Monaco (57), Delaware (5,908), Virginia (81,289) = 87,254 total segments, 172 MB

---

## Benchmark Results

### Delaware (small state)

| Metric | Value |
|--------|-------|
| `.osm.pbf` size | 20 MB |
| Download time | ~30 seconds |
| Curvature processing | 24 seconds |
| PostGIS loading | 8.5 seconds |
| **Total pipeline time** | **~65 seconds** |
| Segments loaded | 5,908 |
| Row data size | 4.4 MB |

### Virginia (medium state)

| Metric | Value |
|--------|-------|
| `.osm.pbf` size | 400 MB |
| Download time | 18 seconds |
| Curvature processing | ~7 minutes |
| PostGIS loading | 2 minutes 7 seconds |
| **Total pipeline time** | **~9 minutes** |
| Segments loaded | 81,289 |
| Row data size | 87 MB |
| Failed inserts | 24 (duplicates, negligible) |

### Extrapolation to All 50 States

Based on Virginia (400 MB → 81K segments, 87 MB data):

| Metric | Estimate |
|--------|----------|
| Total `.osm.pbf` downloads | ~15-20 GB |
| Total segments | **1.5-2.5 million** |
| Total DB size (with indexes) | **2-4 GB** |
| Total processing time | **4-8 hours** |
| Peak disk usage | ~1.2 GB (California) |

**Conclusion**: Local PostgreSQL is sufficient. No cloud DB needed.

---

## Issues Found and Resolved

### 1. Port conflict: Local PostgreSQL vs Docker

**Problem**: Local PostgreSQL @17 (brew) was listening on port 5432, intercepting connections meant for Docker's PostgreSQL.

**Solution**: `brew services stop postgresql@17`

**Prevention**: Before running the batch, ensure local PostgreSQL is stopped or remap Docker's DB to a different port.

### 2. Bug in `curvature-output-postgis` line 59

**Problem**: When using `--clear` on a source with no existing data, the `ST_Union` aggregate returns `NULL`, causing a crash in `BBox.from_geojson_string()`.

**Fix applied**:
```python
# Before
if result is not None:

# After
if result is not None and result[0] is not None:
```

**Status**: Fixed in local codebase. Should be committed.

### 3. Python environment dependencies

**Problem**: Running the pipeline requires dependencies (`osmium`, `msgpack`, `psycopg2`) that may not be in the system Python.

**Solution**: Always activate the project venv before running:
```bash
source venv/bin/activate
```

**Required packages** (verified working in venv):
- osmium
- msgpack
- psycopg2-binary
- geojson

**Note**: Docker is the most compatible environment. Consider adding curvature pipeline tools to the API container for future runs.

---

## Key Questions (Answered)

### 1. Why did the downloads fail?

**Answer**: Transient network issue on Jan 20, 2026. Downloads work fine now via `wget` to Geofabrik.

### 2. Where should this run?

**Answer**: Local machine is fine for the initial load. Recommend:
- Stop local PostgreSQL (`brew services stop postgresql@17`)
- Activate project venv (`source venv/bin/activate`)
- Run `scripts/process_us_states.sh` with appropriate DB credentials

For future monthly refreshes, consider adding the pipeline to the Docker API container.

### 3. Disk and time budget

**Answer**:
- Peak disk: ~1.2 GB (one state at a time)
- Total time: 4-8 hours for all 50 states
- Monthly refreshes: same timeframe, can run overnight

### 4. Database sizing and cost

**Answer**: 2-4 GB total, well within local PostgreSQL capacity. No managed hosting needed unless you want availability/backups.

### 5. Incremental vs. clean load

**Answer**: Use `--clear` (`-C` flag) for initial load. Future monthly refreshes can use incremental mode (content hashing) to save time.

### 6. Error recovery

**Answer**: The `-r` flag resumes from the last failed state. Reset `data/osm/processing_status.txt` before a fresh batch.

---

## Execution Plan

### Phase 1: Diagnose download failure ✅ COMPLETE

Downloads work. Issue was transient.

### Phase 2: Validate with small state ✅ COMPLETE

Delaware processed: 5,908 segments, 65 seconds total.

### Phase 3: Estimate scale ✅ COMPLETE

Virginia processed: 81,289 segments, 9 minutes total. Extrapolation shows local PostgreSQL is sufficient.

### Phase 4: Full batch run ⏳ READY

**Prerequisites**:
1. Stop local PostgreSQL: `brew services stop postgresql@17`
2. Ensure Docker DB is running: `docker compose ps`
3. Reset status file: `rm data/osm/processing_status.txt`
4. Activate venv: `source venv/bin/activate`

**Command**:
```bash
./scripts/process_us_states.sh -v -k \
  -H localhost \
  -D curvature \
  -u curvature \
  -p curvature_dev_password
```

Options:
- `-v`: Verbose output
- `-k`: Keep `.pbf` files (optional, for debugging)
- `-r`: Resume from last failure (if interrupted)

**Monitoring**:
- Logs: `tail -f data/osm/processing.log`
- Status: `cat data/osm/processing_status.txt`

### Phase 5: Verify and optimize

After batch completes:
1. Check all sources: `curl http://localhost:8000/curvature/sources`
2. Verify on map: Open http://localhost:3000 and pan across US
3. Run VACUUM ANALYZE:
   ```bash
   docker compose exec db psql -U curvature -d curvature -c "VACUUM ANALYZE;"
   ```
4. Check query performance with EXPLAIN ANALYZE

---

## Open Decisions

- [x] Where to run the processing → Local machine with venv
- [x] Database hosting strategy → Local Docker PostgreSQL (2-4 GB is fine)
- [x] Budget for managed hosting → Not needed
- [ ] Whether to parallelize state processing → Not needed for initial load; consider for refreshes
- [ ] Data refresh cadence → Monthly recommended (roads don't change often)
- [ ] Add pipeline tools to Docker API container for easier future runs

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `bin/curvature-output-postgis:59` | Fix NULL geometry crash | Applied, needs commit |
| `api/schema/curvature_indexes.sql` | Performance indexes | Applied to Docker DB |
