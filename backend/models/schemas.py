from pydantic import BaseModel
from typing import Optional


class ComputePool(BaseModel):
    name: str
    state: str
    min_nodes: int
    max_nodes: int
    instance_family: str
    owner: str
    auto_resume: bool
    auto_suspend_secs: Optional[int] = None
    created_on: Optional[str] = None


class Service(BaseModel):
    name: str
    database_name: str
    schema_name: str
    owner: str
    compute_pool: str
    dns_name: Optional[str] = None
    current_instances: int
    target_instances: int
    min_instances: int
    max_instances: int
    status: str
    external_access_integrations: list[str] = []


class Notebook(BaseModel):
    name: str
    database_name: str
    schema_name: str
    owner: str
    comment: Optional[str] = None
    created_on: Optional[str] = None
    query_warehouse: Optional[str] = None
    idle_auto_shutdown_time_seconds: Optional[int] = None


class ExternalAccessIntegration(BaseModel):
    name: str
    type: str
    category: Optional[str] = None
    enabled: bool
    comment: Optional[str] = None
    created_on: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    type: str  # 'computePool', 'service', 'notebook', 'eai'
    data: dict


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
