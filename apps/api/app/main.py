from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.routers import ai_routes, core_routes, portal

app = FastAPI(title="CarePilot API", version="0.1.0")
app.include_router(core_routes.router, prefix="/api")
app.include_router(ai_routes.router, prefix="/api")
app.include_router(portal.router, prefix="/api")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
