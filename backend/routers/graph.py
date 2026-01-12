from fastapi import APIRouter, HTTPException

from backend.models import GraphData, ComputePool, Service, Notebook, ExternalAccessIntegration
from backend.services.snowflake_service import get_snowflake_service

router = APIRouter(prefix="/api", tags=["graph"])


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@router.get("/graph", response_model=GraphData)
async def get_graph():
    """Get complete graph data for visualization."""
    try:
        service = get_snowflake_service()
        return service.get_graph_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compute-pools", response_model=list[ComputePool])
async def get_compute_pools():
    """Get all compute pools."""
    try:
        service = get_snowflake_service()
        return service.get_compute_pools()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services", response_model=list[Service])
async def get_services():
    """Get all Snowpark Container Services."""
    try:
        service = get_snowflake_service()
        return service.get_services()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notebooks", response_model=list[Notebook])
async def get_notebooks():
    """Get all notebooks."""
    try:
        service = get_snowflake_service()
        return service.get_notebooks()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/external-access-integrations", response_model=list[ExternalAccessIntegration])
async def get_external_access_integrations():
    """Get all external access integrations."""
    try:
        service = get_snowflake_service()
        return service.get_external_access_integrations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
