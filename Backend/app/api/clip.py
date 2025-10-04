from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import os
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import uuid
from datetime import datetime

from app.services.clipper.service import ClipperService
from app.auth import get_current_user

router = APIRouter(prefix="/clip", tags=["clip"])
clipper_service = ClipperService()


# Models kept in the router layer to shape requests/responses
class WebhookConfig(BaseModel):
    url: HttpUrl
    events: List[str] = ["completed", "failed"]
    headers: Optional[dict] = None


class ClipRequest(BaseModel):
    video_url: str
    start_time: str
    end_time: str
    title: str = "Clipped Video"
    description: str = "This is a clipped segment."
    tags: List[str] = ["clip"]
    category_id: str = "22"
    privacy_status: str = "unlisted"
    webhook: Optional[WebhookConfig] = None
    thumbnail_url: Optional[HttpUrl] = None


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


@router.get("/")
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


@router.post("", response_model=JobStatus)
async def create_clip(request: ClipRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    
    # Convert ClipRequest to the service's expected format
    from app.services.clipper.service import ClipRequest as ServiceClipRequest
    service_request = ServiceClipRequest(
        video_url=request.video_url,
        start_time=request.start_time,
        end_time=request.end_time,
        title=request.title,
        description=request.description,
        tags=request.tags,
        category_id=request.category_id,
        privacy_status=request.privacy_status,
        webhook=request.webhook
    )
    
    # Start background processing
    background_tasks.add_task(clipper_service.process_clip_job, job_id, service_request)
    
    # Return initial job status
    return JobStatus(
        job_id=job_id,
        status="pending",
        progress="Job created",
        created_at=datetime.now().isoformat()
    )


@router.get("/job/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str, current_user: dict = Depends(get_current_user)):
    job = clipper_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**job)


@router.get("/jobs")
def list_jobs():
    return {"jobs": clipper_service.list_jobs()}


@router.delete("/job/{job_id}")
def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    success = clipper_service.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}


@router.post("/webhook/test")
async def test_webhook(webhook: WebhookConfig):
    from app.services.clipper.service import WebhookConfig as ServiceWebhookConfig, WebhookPayload
    service_webhook = ServiceWebhookConfig(
        url=webhook.url,
        events=webhook.events,
        headers=webhook.headers
    )
    payload = WebhookPayload(
        event="test",
        job_id="test-job-123",
        status="test",
        video_id="test-video-xyz",
        video_url="https://youtube.com/watch?v=test-video-xyz",
        timestamp=datetime.now().isoformat()
    )
    success = await clipper_service.send_webhook(service_webhook, payload)
    return {"success": success, "message": "Test webhook sent successfully", "payload": payload.dict()}


@router.get("/health")
def clipper_health_check():
    # lightweight health info; service-level checks could be added
    return {"status": "healthy", "db": bool(clipper_service.list_jobs())}
    
