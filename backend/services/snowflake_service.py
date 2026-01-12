import os
from pathlib import Path
from typing import Optional
from functools import lru_cache

from snowflake.snowpark import Session
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

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
                # Try to find a matching key file
                possible_keys = [
                    ssh_dir / f"{params.get('user', 'snowflake')}_rsa_key.p8",
                    ssh_dir / "mcastro_aws1_uswest2_key.p8",
                    ssh_dir / "rsa_key.p8",
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
                except Exception:
                    # If that fails, try as raw bytes
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

    def get_compute_pools(self) -> list[ComputePool]:
        """Fetch all compute pools."""
        self.session.sql("SHOW COMPUTE POOLS").collect()
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
        """Fetch all Snowpark Container Services."""
        self.session.sql("SHOW SERVICES").collect()
        df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

        services = []
        for _, row in df.iterrows():
            # Get EAI list for this service
            eai_list = self._get_service_eai(
                row.get("database_name", ""),
                row.get("schema_name", ""),
                row.get("name", ""),
            )

            services.append(
                Service(
                    name=row.get("name", ""),
                    database_name=row.get("database_name", ""),
                    schema_name=row.get("schema_name", ""),
                    owner=row.get("owner", ""),
                    compute_pool=row.get("compute_pool", ""),
                    dns_name=row.get("dns_name"),
                    current_instances=int(row.get("current_instances", 0)),
                    target_instances=int(row.get("target_instances", 0)),
                    min_instances=int(row.get("min_instances", 0)),
                    max_instances=int(row.get("max_instances", 0)),
                    status=row.get("status", "UNKNOWN"),
                    external_access_integrations=eai_list,
                )
            )
        return services

    def _get_service_eai(self, database: str, schema: str, service_name: str) -> list[str]:
        """Get external access integrations for a service from its spec."""
        try:
            fqn = f"{database}.{schema}.{service_name}"
            self.session.sql(f"DESCRIBE SERVICE {fqn}").collect()
            df = self.session.sql("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))").to_pandas()

            # Look for external_access_integrations in the spec
            for _, row in df.iterrows():
                if "spec" in str(row).lower():
                    spec = str(row.get("spec", ""))
                    # Parse EXTERNAL_ACCESS_INTEGRATIONS from spec YAML
                    if "EXTERNAL_ACCESS_INTEGRATIONS" in spec.upper():
                        # Simple extraction - in production, use proper YAML parsing
                        import re

                        matches = re.findall(r"EXTERNAL_ACCESS_INTEGRATIONS:\s*\[([^\]]+)\]", spec, re.IGNORECASE)
                        if matches:
                            return [eai.strip().strip("'\"") for eai in matches[0].split(",")]
        except Exception:
            pass
        return []

    def get_notebooks(self) -> list[Notebook]:
        """Fetch all notebooks."""
        self.session.sql("SHOW NOTEBOOKS").collect()
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
        self.session.sql("SHOW EXTERNAL ACCESS INTEGRATIONS").collect()
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
        """Build complete graph data structure for visualization."""
        compute_pools = self.get_compute_pools()
        services = self.get_services()
        notebooks = self.get_notebooks()
        eais = self.get_external_access_integrations()

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

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

            # Edge: service -> compute pool
            if svc.compute_pool:
                edges.append(
                    GraphEdge(
                        id=f"e-svc-cp-{svc.name}",
                        source=f"svc-{svc.database_name}.{svc.schema_name}.{svc.name}",
                        target=f"cp-{svc.compute_pool}",
                        label="runs on",
                    )
                )

            # Edges: service -> EAI
            for eai_name in svc.external_access_integrations:
                edges.append(
                    GraphEdge(
                        id=f"e-svc-eai-{svc.name}-{eai_name}",
                        source=f"svc-{svc.database_name}.{svc.schema_name}.{svc.name}",
                        target=f"eai-{eai_name}",
                        label="uses",
                    )
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
