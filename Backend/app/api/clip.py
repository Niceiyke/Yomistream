from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import os
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import uuid
from datetime import datetime

from app.services import clipper as clipper_service
from app.auth import get_current_user

router = APIRouter()


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


@router.post("/", response_model=JobStatus)
async def create_clip(request: ClipRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    clipper_service.create_job_record(job_id, created_at=datetime.now().isoformat())

    # convert request to a plain dict suitable for the service
    req_dict = request.dict()
    # background processing using service
    background_tasks.add_task(clipper_service.process_clip_job, job_id, req_dict)

    job = clipper_service.get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=500, detail="Failed to create job")
    # coerce required fields to non-None defaults
    job_id_val = job.get('job_id') or job_id
    status_val = job.get('status') or 'pending'
    progress_val = job.get('progress') or 'Job created'
    created_at_val = job.get('created_at') or datetime.now().isoformat()
    return JobStatus(**{
        'job_id': str(job_id_val),
        'status': str(status_val),
        'progress': str(progress_val),
        'video_id': job.get('video_id'),
        'video_url': job.get('video_url'),
        'error': job.get('error'),
        'created_at': str(created_at_val),
        'completed_at': job.get('completed_at')
    })


@router.get("/job/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str, current_user: dict = Depends(get_current_user)):
    job = clipper_service.get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**job)


@router.get("/jobs")
def list_jobs(current_user: dict = Depends(get_current_user)):
    return {"jobs": clipper_service.list_jobs()}


@router.delete("/job/{job_id}")
def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = clipper_service.get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    clipper_service.delete_job_record(job_id)
    return {"message": "Job deleted successfully"}


@router.post("/webhook/test")
async def test_webhook(webhook: WebhookConfig):
    payload = {"event": "completed", "job_id": "test-job-123", "status": "completed", "video_id": "test-video-xyz", "video_url": "https://youtube.com/watch?v=test-video-xyz", "error": None, "timestamp": datetime.now().isoformat()}
    await clipper_service.send_webhook(str(webhook.url), payload, webhook.headers or {})
    return {"success": True, "message": "Test webhook sent successfully", "payload": payload}


@router.get("/health")
def clipper_health_check():
    # lightweight health info; service-level checks could be added
    return {"status": "healthy", "db": bool(clipper_service.list_jobs())}
    
