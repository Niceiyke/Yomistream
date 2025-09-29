# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.endpoints import router as api_router
from app.api.data import router as data_router
from app.api.favorites import router as favorites_router
from app.api.ai import router as ai_router
from app.api.admin import router as admin_router
import logging

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
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")
app.include_router(data_router, prefix="/api")
app.include_router(favorites_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)