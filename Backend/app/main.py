# app/main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import os
import subprocess
import uuid
import httpx
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
import pickle
from datetime import datetime

from app.config import settings
from app.api.endpoints import router as api_router
from app.api.data import router as data_router
from app.api.favorites import router as favorites_router
from app.api.ai import router as ai_router
from app.api.admin import router as admin_router
from app.api.clip import router as clipper_router
import logging
from app.services import clipper as clipper_service

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

# Include existing API routes
app.include_router(api_router, prefix="/api")
app.include_router(data_router, prefix="/api")
app.include_router(favorites_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
# Include clipper router (modularized)
app.include_router(clipper_router, prefix="/api/clip")


@app.on_event("startup")
def on_startup():
    # Initialize clipper DB and any required directories
    try:
        clipper_service.init_db()
        logger.info("Clipper DB initialized at %s", clipper_service.DB_PATH)
    except Exception as e:
        logger.warning("Failed to initialize clipper DB: %s", e)


# --- Begin merged clipper API (from main2.py) ---

# ===== CONFIG =====
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
UPLOAD_DIR = "uploads"
TEMP_DIR = "temp"

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory job store
jobs = {}

# ===== MODELS =====
class WebhookConfig(BaseModel):
    url: HttpUrl
    events: List[str] = ["completed", "failed"]
    headers: Optional[dict] = None

class ClipRequest(BaseModel):
    video_url: HttpUrl
    start_time: str
    end_time: str
    title: str = "Clipped Video"
    description: str = "This is a clipped segment."
    tags: List[str] = ["clip"]
    category_id: str = "22"
    privacy_status: str = "unlisted"
    webhook: Optional[WebhookConfig] = None

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class WebhookPayload(BaseModel):
    event: str
    job_id: str
    status: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


async def send_webhook(webhook_config: WebhookConfig, payload: WebhookPayload):
    if payload.event not in webhook_config.events:
        return
    try:
        headers = webhook_config.headers or {}
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                str(webhook_config.url),
                json=payload.dict(),
                headers=headers
            )
            response.raise_for_status()
            logger.info(f"Webhook sent to %s", webhook_config.url)
    except Exception as e:
        logger.warning("Webhook failed: %s", e)


def update_job_status(job_id: str, status: str, progress: str, 
                     video_id: str = '', error: str = ''):
    jobs[job_id].update({
        "status": status,
        "progress": progress,
        "video_id": video_id,
        "error": error
    })
    if status in ["completed", "failed"]:
        jobs[job_id]["completed_at"] = datetime.now().isoformat()
    if video_id:
        jobs[job_id]["video_url"] = f"https://youtube.com/watch?v={video_id}"


def cleanup_files(*files):
    for file in files:
        if os.path.exists(file):
            try:
                os.remove(file)
            except Exception:
                pass


def get_youtube_service():
    if not os.path.exists("client_secret.json"):
        raise Exception("Missing client_secret.json file")
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "client_secret.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)
    return build("youtube", "v3", credentials=creds)


def download_video(url: HttpUrl, output: str, job_id: str) -> bool:
    try:
        update_job_status(job_id, "processing", "Downloading video...")
        subprocess.run([
            "yt-dlp",
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "-o", output,
            str(url)
        ], check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def trim_video(input_file: str, output_file: str, start: str, 
               end: str, job_id: str) -> bool:
    try:
        update_job_status(job_id, "processing", "Trimming video...")
        subprocess.run([
            "ffmpeg",
            "-i", input_file,
            "-ss", start,
            "-to", end,
            "-c", "copy",
            output_file,
            "-y"
        ], check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def upload_video(youtube, file: str, title: str, description: str, 
                tags: List[str], category: str, privacy: str, job_id: str):
    update_job_status(job_id, "processing", "Uploading to YouTube...")
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category
        },
        "status": {
            "privacyStatus": privacy
        }
    }
    try:
        media = MediaFileUpload(file, chunksize=1024*1024, resumable=True)
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media
        )
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                update_job_status(job_id, "processing", 
                                f"Uploading: {progress}%")
        return response
    except HttpError as e:
        raise Exception(f"Upload failed: {str(e)}")


async def process_clip_job(job_id: str, request: ClipRequest):
    temp_video = os.path.join(TEMP_DIR, f"{job_id}_original.mp4")
    clipped_video = os.path.join(TEMP_DIR, f"{job_id}_clipped.mp4")
    try:
        if not download_video(request.video_url, temp_video, job_id):
            raise Exception("Failed to download video")
        if not trim_video(temp_video, clipped_video, 
                         request.start_time, request.end_time, job_id):
            raise Exception("Failed to trim video")
        youtube = get_youtube_service()
        response = upload_video(
            youtube, clipped_video, request.title, request.description,
            request.tags, request.category_id, request.privacy_status, job_id
        )
        video_id = response["id"]
        update_job_status(job_id, "completed", "Upload successful!", 
                         video_id=video_id)
        if request.webhook:
            payload = WebhookPayload(
                event="completed",
                job_id=job_id,
                status="completed",
                video_id=video_id,
                video_url=f"https://youtube.com/watch?v={video_id}",
                error=None,
                timestamp=datetime.now().isoformat()
            )
            await send_webhook(request.webhook, payload)
    except Exception as e:
        error_msg = str(e)
        update_job_status(job_id, "failed", "Error occurred", 
                         error=error_msg)
        if request.webhook:
            payload = WebhookPayload(
                event="failed",
                job_id=job_id,
                status="failed",
                video_id=None,
                video_url=None,
                error=error_msg,
                timestamp=datetime.now().isoformat()
            )
            await send_webhook(request.webhook, payload)
    finally:
        cleanup_files(temp_video, clipped_video)


# Create an APIRouter for clipper endpoints and mount it under /api/clip
clipper_router = APIRouter()


@clipper_router.get("/")
def clip_root():
    return {
        "name": "YouTube Video Clipper API with Webhooks",
        "version": "2.0",
        "endpoints": {
            "POST /api/clip": "Submit a new clip job (with optional webhook)",
            "GET /api/clip/job/{job_id}": "Check job status",
            "GET /api/clip/jobs": "List all jobs",
            "POST /api/clip/webhook/test": "Test webhook endpoint",
            "GET /api/clip/health": "Health check"
        },
        "webhook_events": ["completed", "failed"]
    }


@clipper_router.post("/", response_model=JobStatus)
async def create_clip(request: ClipRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": "Job created",
        "video_id": None,
        "video_url": None,
        "error": None,
        "created_at": datetime.now().isoformat(),
        "completed_at": None
    }
    background_tasks.add_task(process_clip_job, job_id, request)
    return JobStatus(**jobs[job_id])


@clipper_router.get("/job/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**jobs[job_id])


@clipper_router.get("/jobs")
def list_jobs():
    return {"jobs": list(jobs.values())}


@clipper_router.delete("/job/{job_id}")
def delete_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    del jobs[job_id]
    return {"message": "Job deleted successfully"}


@clipper_router.post("/webhook/test")
async def test_webhook(webhook: WebhookConfig):
    test_payload = WebhookPayload(
        event="completed",
        job_id="test-job-123",
        status="completed",
        video_id="test-video-xyz",
        video_url="https://youtube.com/watch?v=test-video-xyz",
        error=None,
        timestamp=datetime.now().isoformat()
    )
    try:
        await send_webhook(webhook, test_payload)
        return {
            "success": True,
            "message": "Test webhook sent successfully",
            "payload": test_payload.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook test failed: {str(e)}")


@clipper_router.get("/health")
def clipper_health_check():
    tools_status = {}
    for tool in ["yt-dlp", "ffmpeg"]:
        try:
            subprocess.run([tool, "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            tools_status[tool] = "available"
        except FileNotFoundError:
            tools_status[tool] = "missing"
    has_credentials = os.path.exists("client_secret.json")
    has_token = os.path.exists("token.pickle")
    return {
        "status": "healthy",
        "tools": tools_status,
        "credentials": {
            "client_secret": has_credentials,
            "token": has_token
        },
        "active_jobs": len([j for j in jobs.values() if j["status"] == "processing"]),
        "total_jobs": len(jobs)
    }

# Mount the clipper router under /api/clip
app.include_router(clipper_router, prefix="/api/clip")

# --- End merged clipper API ---


# Lightweight root health endpoint (keeps backward compatibility)
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# API-scoped health endpoint so reverse proxies and compose healthchecks
# can use the `/api` prefix the application routes are mounted under.
@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "api": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)