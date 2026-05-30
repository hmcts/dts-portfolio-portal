from fastapi import FastAPI

from app.api import (
    activity,
    domains,
    health,
    jurisdictions,
    matrix,
    ops,
    products,
    search,
    sidebar,
    teams,
)

app = FastAPI(
    title="DTS Portfolio Portal API",
    description="Read-path API for the DTS Portfolio Portal",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url=None,
)

app.include_router(health.router)
app.include_router(matrix.router)
app.include_router(activity.router)
app.include_router(sidebar.router)
app.include_router(jurisdictions.router)
app.include_router(domains.router)
app.include_router(teams.router)
app.include_router(products.router)
app.include_router(ops.router)
app.include_router(search.router)
