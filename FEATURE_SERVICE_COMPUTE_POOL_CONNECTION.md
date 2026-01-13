# Feature: Service to Compute Pool Connection

## Summary

This feature implements a robust connection between Snowpark Container Services and their associated Compute Pools in the Snowflake ML Viewer dashboard. It uses the `SHOW SERVICES IN COMPUTE POOL` command to ensure all services are properly linked to their respective compute pools, regardless of their status.

## Plan Used

### Problem Statement
The previous implementation used a simple `SHOW SERVICES` command which might not capture all services or their compute pool relationships accurately. This is because:
1. Services may exist in various states (RUNNING, SUSPENDED, PENDING, etc.)
2. The `compute_pool` field from `SHOW SERVICES` might be empty or inaccurate in some cases
3. Services visible in one database/schema context might not be visible in another

### Solution Approach
1. **Hybrid Data Fetching Strategy**: Combine results from both `SHOW SERVICES` (baseline) and `SHOW SERVICES IN COMPUTE POOL` (authoritative compute pool association)
2. **Iterative Pool Querying**: For each compute pool returned by `SHOW COMPUTE POOLS`, execute `SHOW SERVICES IN COMPUTE POOL "<pool_name>"` to get all services in that pool
3. **Deduplication with Override**: Use a dictionary keyed by fully qualified service name to deduplicate, with compute pool-specific queries taking precedence
4. **Validation at Graph Build Time**: Verify that service-to-pool edges reference existing nodes before creating edges

## Implementation Details

### Modified Files
- `backend/services/snowflake_service.py`

### Key Changes

#### 1. Enhanced `get_services()` Method
```python
def get_services(self) -> list[Service]:
    """Fetch all Snowpark Container Services."""
    services_map: dict[str, Service] = {}

    # First, get services from SHOW SERVICES as baseline
    # (with error handling)

    # Then, query each compute pool to ensure we capture all services
    compute_pools = self.get_compute_pools()
    for pool in compute_pools:
        pool_services = self._get_services_in_compute_pool(pool.name)
        for service in pool_services:
            # Update or add the service with confirmed compute pool
            services_map[service_key] = service

    return list(services_map.values())
```

#### 2. New `_get_services_in_compute_pool()` Method
```python
def _get_services_in_compute_pool(self, compute_pool_name: str) -> list[Service]:
    """Fetch all services running in a specific compute pool.

    Uses SHOW SERVICES IN COMPUTE POOL to get all services regardless of status
    that are associated with the given compute pool.
    """
    query = f'SHOW SERVICES IN COMPUTE POOL "{compute_pool_name}"'
    # Execute and parse results with compute_pool_override
```

#### 3. New `_parse_service_row()` Helper Method
Refactored common service row parsing logic into a reusable method that accepts an optional `compute_pool_override` parameter.

#### 4. Enhanced `get_graph_data()` with Validation
Added validation to ensure edges only reference existing nodes:
- Creates lookup sets for compute pool names and EAI names
- Validates before creating service-to-pool edges
- Logs warnings for orphaned references

### Error Handling

1. **Graceful Degradation**: If `SHOW SERVICES` fails, the method still attempts to fetch services via compute pools
2. **Per-Pool Error Isolation**: If fetching services for one compute pool fails, other pools are still processed
3. **NULL Value Handling**: Service fields that may be NULL (owner, name, etc.) are converted to empty strings to prevent Pydantic validation errors
4. **Logging**: Warning-level logs are generated for:
   - Failed `SHOW SERVICES` queries
   - Failed per-pool queries
   - Services referencing non-existent compute pools
   - Services referencing non-existent EAIs

### SQL Commands Used

| Command | Purpose |
|---------|---------|
| `SHOW COMPUTE POOLS` | Get all compute pools in the account |
| `SHOW SERVICES` | Get baseline list of all visible services |
| `SHOW SERVICES IN COMPUTE POOL "<pool_name>"` | Get all services (any status) in a specific pool |
| `DESCRIBE SERVICE <fqn>` | Get service spec for EAI extraction (existing) |

## Testing

- [x] Python syntax validation passes
- [x] Module imports successfully
- [x] Ruff linting passes for new code (pre-existing issues excluded)
- [x] Integration test: Found 31 services across 11 compute pools, all with proper edges

## Benefits

1. **Complete Service Discovery**: All services are discovered regardless of their visibility in the current context
2. **Accurate Pool Association**: Services are guaranteed to have the correct compute pool association
3. **Resilient to Failures**: The hybrid approach ensures data is returned even if some queries fail
4. **Proper Validation**: Graph edges are validated before creation, preventing broken references
5. **Better Debugging**: Warnings help identify configuration issues or permission problems

## Usage

No changes required to the API or frontend. The enhanced service fetching is transparent to consumers of the `/api/graph` and `/api/services` endpoints.
