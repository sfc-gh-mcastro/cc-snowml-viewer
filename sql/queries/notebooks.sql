-- Query Snowflake Notebooks
-- Returns: name, database_name, schema_name, owner, comment, created_on,
--          query_warehouse, idle_auto_shutdown_time_seconds

SHOW NOTEBOOKS;

-- Note: Notebooks connect to services via the kernel/runtime
-- The service relationship is determined by the notebook's runtime configuration
