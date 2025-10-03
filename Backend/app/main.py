# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from pathlib import Path

from app.config import settings
from app.routes.clipper import router as clipper_router
from app.services.clipper.service import ClipperService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="YomiStream API",
    description="API for processing and analyzing sermon videos",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(clipper_router, prefix="/api/clip")

# Startup event
@app.on_event("startup")
async def on_startup():
    """Initialize services on startup."""
    # Ensure required directories exist
    Path("temp").mkdir(exist_ok=True)
    Path("uploads").mkdir(exist_ok=True)
    logger.info("Application startup complete")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}

# API-scoped health endpoint for reverse proxies
@app.get("/api/health")
async def api_health_check():
    """Health check endpoint with /api prefix for reverse proxies."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)