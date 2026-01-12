-- Query Snowpark Container Services
-- Returns: name, database_name, schema_name, owner, compute_pool, dns_name,
--          current_instances, target_instances, min_instances, max_instances, status

SHOW SERVICES;

-- Get service details including external access integrations
-- For each service, run: DESCRIBE SERVICE <database>.<schema>.<service_name>;
-- The spec YAML contains EXTERNAL_ACCESS_INTEGRATIONS list
