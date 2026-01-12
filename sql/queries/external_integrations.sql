-- Query External Access Integrations
-- Returns: name, type, category, enabled, comment, created_on

SHOW EXTERNAL ACCESS INTEGRATIONS;

-- To see which network rules an integration uses:
-- DESCRIBE EXTERNAL ACCESS INTEGRATION <integration_name>;

-- Common EAI types:
-- - PYPI_EAI: PyPI package installation
-- - OAI_EAI: OpenAI API access
-- - Custom integrations for other external services
