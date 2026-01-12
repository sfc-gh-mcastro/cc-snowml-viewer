from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.graph import router as graph_router
from backend.services.snowflake_service import get_snowflake_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown: close Snowflake session
    service = get_snowflake_service()
    service.close()


app = FastAPI(
    title="Snowflake ML Viewer API",
    description="API for visualizing Snowflake compute pools, services, and notebooks",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph_router)


@app.get("/")
async def root():
    return {"message": "Snowflake ML Viewer API", "docs": "/docs"}
