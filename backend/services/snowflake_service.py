import os
import logging
from pathlib import Path
from typing import Optional
from functools import lru_cache

from snowflake.snowpark import Session
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)

# Debug mode for query logging - set via environment variable
DEBUG_QUERIES = os.getenv("DEBUG_SNOWFLAKE_QUERIES", "false").lower() in ("true", "1", "yes")

if DEBUG_QUERIES:
    logger.setLevel(logging.DEBUG)
    # Ensure we have a handler that shows debug messages
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)

try:
    import tomllib
except ImportError:
    import tomli as tomllib

from backend.models import (
    ComputePool,
    Service,
    Notebook,
    ExternalAccessIntegration,
    GraphNode,
    GraphEdge,
    GraphData,
)

load_dotenv()


def load_snow_connection(connection_name: str) -> dict:
    """Load connection parameters from snow CLI connections.toml."""
    connections_path = Path.home() / ".snowflake" / "connections.toml"
    if not connections_path.exists():
        connections_path = Path.home() / ".config" / "snowflake" / "connections.toml"

    if not connections_path.exists():
        raise FileNotFoundError(f"Snow CLI connections.toml not found")

    with open(connections_path, "rb") as f:
        connections = tomllib.load(f)

    if connection_name not in connections:
        raise KeyError(f"Connection '{connection_name}' not found in connections.toml")

    return dict(connections[connection_name])


def get_connection_parameters() -> dict:
    """Build Snowflake connection parameters from env vars or snow CLI config."""
    # Check if using a snow CLI connection name
    connection_name = os.getenv("SNOWFLAKE_CONNECTION")
    if connection_name:
        params = load_snow_connection(connection_name)
        # Handle JWT authentication with private key file
        if params.get("authenticator") == "SNOWFLAKE_JWT":
            private_key_path = params.get("private_key_file") or params.get("private_key_path")
            # If no key path specified, try common locations
            if not private_key_path:
                ssh_dir = Path.home() / ".ssh"
                user = params.get('user', 'snowflake')
                # Try to find a matching key file
                possible_keys = [
                    ssh_dir / f"{user}_rsa_key.p8",
                    ssh_dir / f"{user}_rsa_key.pem",
                    ssh_dir / "rsa_key.p8",
                    ssh_dir / "snowflake_rsa_key.p8",
                ]
                for key_path in possible_keys:
                    if key_path.exists():
                        private_key_path = str(key_path)
                        break
            if private_key_path:
                private_key_path = os.path.expanduser(private_key_path)
                with open(private_key_path, "rb") as key_file:
                    key_data = key_file.read()

                # Try to load the key - handle both encrypted and unencrypted
                passphrase = os.getenv("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE", "").encode() or None
                try:
                    private_key = serialization.load_pem_private_key(
                        key_data,
                        password=passphrase,
                        backend=default_backend(),
                    )
                    # Convert to DER format for Snowflake
                    params["private_key"] = private_key.private_bytes(
                        encoding=serialization.Encoding.DER,
                        format=serialization.PrivateFormat.PKCS8,
                        encryption_algorithm=serialization.NoEncryption(),
                    )
                except Exception as e:
                    # If that fails, try as raw bytes and log the error
                    logger.warning(f"Failed to parse private key as PEM, using raw bytes: {e}")
                    params["private_key"] = key_data

                if "private_key_file" in params:
                    del params["private_key_file"]
                if "private_key_path" in params:
                    del params["private_key_path"]
        return params

    # Fall back to environment variables
    params = {
        "account": os.getenv("SNOWFLAKE_ACCOUNT"),
        "user": os.getenv("SNOWFLAKE_USER"),
        "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        "database": os.getenv("SNOWFLAKE_DATABASE", "SNOWFLAKE"),
        "schema": os.getenv("SNOWFLAKE_SCHEMA", "ACCOUNT_USAGE"),
        "role": os.getenv("SNOWFLAKE_ROLE", "ACCOUNTADMIN"),
    }

    # Check for PAT (Programmatic Access Token) first
    pat = os.getenv("SNOWFLAKE_PAT")
    if pat:
        params["authenticator"] = "PROGRAMMATIC_ACCESS_TOKEN"
        params["token"] = pat
    else:
        authenticator = os.getenv("SNOWFLAKE_AUTHENTICATOR")
        if authenticator:
            params["authenticator"] = authenticator
        else:
            params["password"] = os.getenv("SNOWFLAKE_PASSWORD")

    return params


class SnowflakeService:
    def __init__(self):
        self._session: Optional[Session] = None

    @property
    def session(self) -> Session:
        if self._session is None:
            self._session = Session.builder.configs(get_connection_parameters()).create()
        return self._session

    def close(self):
        if self._session:
            self._session.close()
            self._session = None

    def _execute_sql(self, query: str):
        """Execute a SQL query with optional debug logging.

        When DEBUG_SNOWFLAKE_QUERIES is enabled, logs the query before execution.

        Args:
            query: The SQL query to execute

        Returns:
            The result of session.sql(query).collect()
        """
        if DEBUG_QUERIES:
            logger.debug(f"Executing Snowflake query: {query}")
        return self.session.sql(query).collect()

    def get_compute_pools(self) -> list[ComputePool]:
        """Fetch all compute pools."""
        self._execute_sql("SHOW COMPUTE POOLS")
        df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

        pools = []
        for _, row in df.iterrows():
            pools.append(
                ComputePool(
                    name=row.get("name", ""),
                    state=row.get("state", "UNKNOWN"),
                    min_nodes=int(row.get("min_nodes", 0)),
                    max_nodes=int(row.get("max_nodes", 0)),
                    instance_family=row.get("instance_family", ""),
                    owner=row.get("owner", ""),
                    auto_resume=row.get("auto_resume", False),
                    auto_suspend_secs=row.get("auto_suspend_secs"),
                    created_on=str(row.get("created_on", "")),
                )
            )
        return pools

    def get_services(self) -> list[Service]:
        """Fetch all Snowpark Container Services.

        This method first tries SHOW SERVICES to get a baseline list,
        then enhances it by querying SHOW SERVICES IN COMPUTE POOL for each pool
        to ensure we capture all services and their compute pool relationships.
        """
        services_map: dict[str, Service] = {}

        # First, get services from SHOW SERVICES as baseline
        try:
            self._execute_sql("SHOW SERVICES")
            df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

            for _, row in df.iterrows():
                service = self._parse_service_row(row)
                service_key = f"{service.database_name}.{service.schema_name}.{service.name}"
                services_map[service_key] = service
        except Exception as e:
            logger.warning(f"Failed to fetch services with SHOW SERVICES: {e}")

        # Then, query each compute pool to ensure we capture all services
        # and have accurate compute pool associations
        try:
            compute_pools = self.get_compute_pools()
            for pool in compute_pools:
                pool_services = self._get_services_in_compute_pool(pool.name)
                for service in pool_services:
                    service_key = f"{service.database_name}.{service.schema_name}.{service.name}"
                    # Update or add the service with confirmed compute pool
                    services_map[service_key] = service
        except Exception as e:
            logger.warning(f"Failed to fetch services by compute pool: {e}")

        return list(services_map.values())

    def _get_services_in_compute_pool(self, compute_pool_name: str) -> list[Service]:
        """Fetch all services running in a specific compute pool.

        Uses SHOW SERVICES IN COMPUTE POOL to get all services regardless of status
        that are associated with the given compute pool.

        Args:
            compute_pool_name: The name of the compute pool to query

        Returns:
            List of Service objects running in the compute pool
        """
        services = []
        try:
            # Quote the compute pool name to handle special characters
            query = f'SHOW SERVICES IN COMPUTE POOL "{compute_pool_name}"'
            self._execute_sql(query)
            df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

            for _, row in df.iterrows():
                service = self._parse_service_row(row, compute_pool_override=compute_pool_name)
                services.append(service)

            logger.debug(f"Found {len(services)} services in compute pool {compute_pool_name}")
        except Exception as e:
            logger.warning(f"Failed to fetch services in compute pool {compute_pool_name}: {e}")

        return services

    def _parse_service_row(self, row, compute_pool_override: str | None = None) -> Service:
        """Parse a service row from SHOW SERVICES query result.

        Args:
            row: A pandas DataFrame row from SHOW SERVICES result
            compute_pool_override: Optional compute pool name to use instead of row value

        Returns:
            A Service object populated from the row data
        """
        # Get EAI list for this service
        eai_list = self._get_service_eai(
            row.get("database_name", ""),
            row.get("schema_name", ""),
            row.get("name", ""),
        )

        # Use override if provided, otherwise get from row
        compute_pool = (
            compute_pool_override if compute_pool_override else row.get("compute_pool", "")
        )

        return Service(
            name=row.get("name", "") or "",
            database_name=row.get("database_name", "") or "",
            schema_name=row.get("schema_name", "") or "",
            owner=row.get("owner", "") or "",
            compute_pool=compute_pool or "",
            dns_name=row.get("dns_name"),
            current_instances=int(row.get("current_instances") or 0),
            target_instances=int(row.get("target_instances") or 0),
            min_instances=int(row.get("min_instances") or 0),
            max_instances=int(row.get("max_instances") or 0),
            status=row.get("status", "UNKNOWN") or "UNKNOWN",
            external_access_integrations=eai_list,
        )

    def _get_service_eai(self, database: str, schema: str, service_name: str) -> list[str]:
        """Get external access integrations for a service from its spec.

        Uses DESCRIBE SERVICE to get the service specification and extracts
        the external_access_integrations field.
        """
        import re

        try:
            fqn = f'"{database}"."{schema}"."{service_name}"'
            self._execute_sql(f"DESCRIBE SERVICE {fqn}")
            df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

            if DEBUG_QUERIES:
                logger.debug(f"DESCRIBE SERVICE {fqn} returned columns: {list(df.columns)}")

            # Check all columns and rows for EAI information
            eai_list = []

            # Method 1: Look for external_access_integrations column directly
            for col in df.columns:
                if "external_access" in col.lower():
                    for _, row in df.iterrows():
                        val = row.get(col)
                        if val and str(val).strip() and str(val).lower() != "none":
                            # Parse as list if it looks like one
                            val_str = str(val).strip()
                            if val_str.startswith("[") and val_str.endswith("]"):
                                # Parse JSON-like list
                                inner = val_str[1:-1]
                                eai_list.extend([e.strip().strip("'\"") for e in inner.split(",") if e.strip()])
                            else:
                                eai_list.append(val_str)

            if eai_list:
                if DEBUG_QUERIES:
                    logger.debug(f"Found EAIs via column search: {eai_list}")
                return eai_list

            # Method 2: Search in spec column for EXTERNAL_ACCESS_INTEGRATIONS
            for col in df.columns:
                if "spec" in col.lower():
                    for _, row in df.iterrows():
                        spec = str(row.get(col, ""))
                        if "EXTERNAL_ACCESS_INTEGRATIONS" in spec.upper():
                            # Try multiple regex patterns
                            patterns = [
                                r"EXTERNAL_ACCESS_INTEGRATIONS\s*:\s*\[([^\]]+)\]",
                                r"external_access_integrations\s*=\s*\[([^\]]+)\]",
                                r'"external_access_integrations"\s*:\s*\[([^\]]+)\]',
                            ]
                            for pattern in patterns:
                                matches = re.findall(pattern, spec, re.IGNORECASE)
                                if matches:
                                    eai_list = [eai.strip().strip("'\"") for eai in matches[0].split(",")]
                                    if DEBUG_QUERIES:
                                        logger.debug(f"Found EAIs via spec parsing: {eai_list}")
                                    return eai_list

            # Method 3: Look through all string values for EAI patterns
            for _, row in df.iterrows():
                for col in df.columns:
                    val = str(row.get(col, ""))
                    if "EXTERNAL_ACCESS_INTEGRATIONS" in val.upper():
                        patterns = [
                            r"EXTERNAL_ACCESS_INTEGRATIONS\s*:\s*\[([^\]]+)\]",
                            r"external_access_integrations\s*=\s*\[([^\]]+)\]",
                        ]
                        for pattern in patterns:
                            matches = re.findall(pattern, val, re.IGNORECASE)
                            if matches:
                                eai_list = [eai.strip().strip("'\"") for eai in matches[0].split(",")]
                                if DEBUG_QUERIES:
                                    logger.debug(f"Found EAIs via full scan: {eai_list}")
                                return eai_list

        except Exception as e:
            if DEBUG_QUERIES:
                logger.debug(f"Error getting EAIs for {database}.{schema}.{service_name}: {e}")
        return []

    def get_notebooks(self) -> list[Notebook]:
        """Fetch all notebooks."""
        self._execute_sql("SHOW NOTEBOOKS")
        df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

        notebooks = []
        for _, row in df.iterrows():
            notebooks.append(
                Notebook(
                    name=row.get("name", ""),
                    database_name=row.get("database_name", ""),
                    schema_name=row.get("schema_name", ""),
                    owner=row.get("owner", ""),
                    comment=row.get("comment"),
                    created_on=str(row.get("created_on", "")),
                    query_warehouse=row.get("query_warehouse"),
                    idle_auto_shutdown_time_seconds=row.get("idle_auto_shutdown_time_seconds"),
                )
            )
        return notebooks

    def get_external_access_integrations(self) -> list[ExternalAccessIntegration]:
        """Fetch all external access integrations."""
        self._execute_sql("SHOW EXTERNAL ACCESS INTEGRATIONS")
        df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

        integrations = []
        for _, row in df.iterrows():
            integrations.append(
                ExternalAccessIntegration(
                    name=row.get("name", ""),
                    type=row.get("type", ""),
                    category=row.get("category"),
                    enabled=row.get("enabled", False),
                    comment=row.get("comment"),
                    created_on=str(row.get("created_on", "")),
                )
            )
        return integrations

    def get_graph_data(self) -> GraphData:
        """Build complete graph data structure for visualization.

        This method fetches all ML infrastructure components and builds
        a graph structure representing their relationships. Services are
        connected to compute pools via 'runs on' edges, and to external
        access integrations via 'uses' edges.
        """
        compute_pools = self.get_compute_pools()
        services = self.get_services()
        notebooks = self.get_notebooks()
        eais = self.get_external_access_integrations()

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        # Create lookup sets for validation
        compute_pool_names = {cp.name for cp in compute_pools}
        eai_names = {eai.name for eai in eais}

        # Add compute pool nodes
        for cp in compute_pools:
            nodes.append(
                GraphNode(
                    id=f"cp-{cp.name}",
                    type="computePool",
                    data={
                        "name": cp.name,
                        "state": cp.state,
                        "minNodes": cp.min_nodes,
                        "maxNodes": cp.max_nodes,
                        "instanceFamily": cp.instance_family,
                        "owner": cp.owner,
                    },
                )
            )

        # Add EAI nodes
        for eai in eais:
            nodes.append(
                GraphNode(
                    id=f"eai-{eai.name}",
                    type="eai",
                    data={
                        "name": eai.name,
                        "type": eai.type,
                        "enabled": eai.enabled,
                    },
                )
            )

        # Add service nodes and edges to compute pools
        for svc in services:
            nodes.append(
                GraphNode(
                    id=f"svc-{svc.database_name}.{svc.schema_name}.{svc.name}",
                    type="service",
                    data={
                        "name": svc.name,
                        "database": svc.database_name,
                        "schema": svc.schema_name,
                        "owner": svc.owner,
                        "computePool": svc.compute_pool,
                        "status": svc.status,
                        "currentInstances": svc.current_instances,
                        "targetInstances": svc.target_instances,
                        "eaiList": svc.external_access_integrations,
                    },
                )
            )

            # Edge: service -> compute pool (validate pool exists)
            if svc.compute_pool:
                if svc.compute_pool in compute_pool_names:
                    edges.append(
                        GraphEdge(
                            id=f"e-svc-cp-{svc.name}",
                            source=f"svc-{svc.database_name}.{svc.schema_name}.{svc.name}",
                            target=f"cp-{svc.compute_pool}",
                            label="runs on",
                        )
                    )
                else:
                    logger.warning(
                        f"Service {svc.name} references compute pool {svc.compute_pool} "
                        "which was not found in available compute pools"
                    )

            # Edges: service -> EAI (validate EAI exists)
            for eai_name in svc.external_access_integrations:
                if eai_name in eai_names:
                    edges.append(
                        GraphEdge(
                            id=f"e-svc-eai-{svc.name}-{eai_name}",
                            source=f"svc-{svc.database_name}.{svc.schema_name}.{svc.name}",
                            target=f"eai-{eai_name}",
                            label="uses",
                        )
                    )
                else:
                    logger.warning(
                        f"Service {svc.name} references EAI {eai_name} "
                        "which was not found in available integrations"
                    )

        # Add notebook nodes
        # Note: Linking notebooks to services requires additional logic based on
        # notebook runtime configuration. For now, we show notebooks grouped by owner.
        for nb in notebooks:
            nodes.append(
                GraphNode(
                    id=f"nb-{nb.database_name}.{nb.schema_name}.{nb.name}",
                    type="notebook",
                    data={
                        "name": nb.name,
                        "database": nb.database_name,
                        "schema": nb.schema_name,
                        "owner": nb.owner,
                        "warehouse": nb.query_warehouse,
                        "idleTimeout": nb.idle_auto_shutdown_time_seconds,
                    },
                )
            )

        return GraphData(nodes=nodes, edges=edges)


@lru_cache()
def get_snowflake_service() -> SnowflakeService:
    """Singleton factory for SnowflakeService."""
    return SnowflakeService()
