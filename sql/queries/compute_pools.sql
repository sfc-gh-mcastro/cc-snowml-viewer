-- Query compute pools across all accessible roles
-- Returns: name, state, min_nodes, max_nodes, instance_family, owner, auto_resume, auto_suspend_secs

SHOW COMPUTE POOLS;

-- Alternative: Query with more details via RESULT_SCAN
-- SELECT
--     "name",
--     "state",
--     "min_nodes",
--     "max_nodes",
--     "instance_family",
--     "owner",
--     "auto_resume",
--     "auto_suspend_secs",
--     "created_on"
-- FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));
