# Feature: Visualization Improvements

## Summary

This feature adds three improvements to the Snowflake ML Viewer:
1. **Debug Mode**: Backend logging of all Snowflake queries
2. **Collapse All / Expand All**: Buttons to quickly manage visualization density
3. **Service-to-EAI Connections**: Visual connections between services and external access integrations

## Implementation Plan

### 1. Debug Mode for Snowflake Queries

**Problem**: Debugging Snowflake queries was difficult without visibility into what SQL was being executed.

**Solution**: Added environment variable `DEBUG_SNOWFLAKE_QUERIES` that enables debug-level logging of all queries.

**Files Modified**:
- `backend/services/snowflake_service.py`

**Changes**:
```python
# Environment variable to enable debug mode
DEBUG_QUERIES = os.getenv("DEBUG_SNOWFLAKE_QUERIES", "false").lower() in ("true", "1", "yes")

# Helper method that logs queries when debug mode is enabled
def _execute_sql(self, query: str):
    if DEBUG_QUERIES:
        logger.debug(f"Executing Snowflake query: {query}")
    return self.session.sql(query).collect()
```

**Usage**:
```bash
# Enable debug logging
DEBUG_SNOWFLAKE_QUERIES=true uv run uvicorn backend.app:app --reload --port 8000
```

### 2. Collapse All / Expand All Buttons

**Problem**: With many services (31+), the visualization was cluttered and hard to navigate.

**Solution**: Added "Collapse All" and "Expand All" buttons in the top-left corner of the graph.

**Files Modified**:
- `frontend/src/components/NetworkGraph.tsx`

**Changes**:
- Added `Panel` component from ReactFlow for button placement
- Implemented `collapseAll()` and `expandAll()` callback functions
- Added button state tracking (`hasCollapsedPools`, `allCollapsed`)
- Styled buttons with Tailwind CSS, including disabled states

**Features**:
- Buttons intelligently disable when not applicable
- Collapse All disables when all pools are already collapsed
- Expand All disables when no pools are collapsed

### 3. Service-to-EAI Connections

**Problem**: Users couldn't see the relationship between services and their external access integrations. The previous implementation had a fragile parsing method that didn't reliably extract EAIs from `DESCRIBE SERVICE` output.

**Solution**: Rewrote the `_get_service_eai()` method with robust multi-method extraction:

**Files Modified**:
- `backend/services/snowflake_service.py`

**Changes**:
```python
def _get_service_eai(self, database: str, schema: str, service_name: str) -> list[str]:
    # Method 1: Look for external_access_integrations column directly
    # Method 2: Search in spec column for EXTERNAL_ACCESS_INTEGRATIONS
    # Method 3: Look through all string values for EAI patterns
```

**Key Improvements**:
1. Properly quoted fully qualified names: `"DATABASE"."SCHEMA"."SERVICE_NAME"`
2. Multiple extraction methods for robustness
3. Debug logging when `DEBUG_SNOWFLAKE_QUERIES=true`
4. Multiple regex patterns for different output formats

**Connection Flow**:
```
Services (x=400) --[runs on]--> Compute Pools (x=750)
Services (x=400) --[uses]-----> External Access Integrations (x=1100)
```

**Files Involved**:
- `backend/services/snowflake_service.py` - Creates "uses" edges between services and EAIs
- `frontend/src/components/nodes/ServiceNode.tsx` - Has source handle on right side
- `frontend/src/components/nodes/EaiNode.tsx` - Has target handle on left side

**Edge Validation**:
- Backend validates EAI names exist before creating edges
- Warnings logged for services referencing non-existent EAIs

## Testing

### Backend Debug Mode
```bash
# Start backend with debug logging
DEBUG_SNOWFLAKE_QUERIES=true uv run uvicorn backend.app:app --reload --port 8000

# View logs - should see lines like:
# DEBUG - Executing Snowflake query: SHOW COMPUTE POOLS
# DEBUG - Executing Snowflake query: SHOW SERVICES
# etc.
```

### Frontend Collapse/Expand
1. Start frontend: `cd frontend && npm run dev`
2. Open browser to http://localhost:3000 (or port shown)
3. Click "Collapse All" - all service groups should collapse
4. Click "Expand All" - all service groups should expand
5. Verify buttons disable appropriately

### Service-to-EAI Connections
1. Start backend with debug: `DEBUG_SNOWFLAKE_QUERIES=true uv run uvicorn backend.app:app --reload --port 8000`
2. Watch logs for "Found EAIs" messages to verify extraction is working
3. Look for purple lines connecting green service nodes to purple EAI nodes
4. Edges should be labeled "uses"
5. Services with no EAIs should not have outgoing edges to EAI column
6. Test with known service: `DESCRIBE SERVICE AICOLLEGE.PUBLIC.SNOW_REMOTE_MCASTRO_MY_REMOTE_DEV`

## Files Modified

| File | Changes |
|------|---------|
| `backend/services/snowflake_service.py` | Added `DEBUG_QUERIES` flag, `_execute_sql()` helper, updated all SQL calls |
| `frontend/src/components/NetworkGraph.tsx` | Added Panel import, collapse/expand functions, buttons UI |

## Benefits

1. **Better Debugging**: Developers can see exact queries being sent to Snowflake
2. **Improved UX**: Users can quickly collapse cluttered visualizations
3. **Complete Visibility**: Full connection flow from compute pools through services to EAIs
