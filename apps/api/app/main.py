from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.ratelimit import security_middleware
from app.routers import ai_routes, core_routes, ops_routes, portal, experience_routes, catalogue_routes, operations_routes

app = FastAPI(title="M3aya Santé API", version="0.5.0")
app.middleware("http")(security_middleware)
app.include_router(core_routes.router, prefix="/api")
app.include_router(ai_routes.router, prefix="/api")
app.include_router(ops_routes.router, prefix="/api")
app.include_router(portal.router, prefix="/api")
app.include_router(experience_routes.router, prefix="/api")
app.include_router(catalogue_routes.router, prefix="/api")
app.include_router(operations_routes.router, prefix="/api")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
