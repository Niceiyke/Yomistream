from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import HttpUrl
from typing import Optional, List, Dict, Any
import uuid
import subprocess
from datetime import datetime

from app.services.clipper.service import ClipperService, ClipRequest, WebhookConfig, JobStatus, WebhookPayload

router = APIRouter()
clipper_service = ClipperService()

@router.get("/health", response_model=Dict[str, str])
async def clipper_health_check():
    """Health check endpoint for the clipper service."""
    try:
        # Check if required binaries are available
        required_binaries = ["ffmpeg", "yt-dlp"]
        missing_binaries = []
        
        for binary in required_binaries:
            try:
                subprocess.run([binary, "--version"], 
                             capture_output=True, 
                             check=True)
            except (subprocess.SubprocessError, FileNotFoundError):
                missing_binaries.append(binary)
        
        if missing_binaries:
            return {
                "status": "degraded",
                "message": f"Missing required binaries: {', '.join(missing_binaries)}",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        return {
            "status": "healthy",
            "message": "Clipper service is running",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "unhealthy",
                "message": f"Health check failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.get("", response_model=Dict[str, Any])
async def clipper_root():
    """Root endpoint for the clipper API."""
    return {
        "message": "YomiStream Clipper API",
        "endpoints": [
            {"path": "/clip", "method": "POST", "description": "Create a new clip job"},
            {"path": "/clip/{job_id}", "method": "GET", "description": "Get job status"},
            {"path": "/clip/{job_id}", "method": "DELETE", "description": "Delete a job"},
            {"path": "/clip/jobs", "method": "GET", "description": "List all jobs"},
            {"path": "/clip/health", "method": "GET", "description": "Service health check"}
        ]
    }

@router.post("", status_code=202, response_model=Dict[str, str])
async def create_clip(
    request: ClipRequest, 
    background_tasks: BackgroundTasks
):
    """
    Create a new clip job.
    
    This endpoint accepts video details and returns a job ID that can be used to track progress.
    The actual processing happens in the background.
    """
    job_id = str(uuid.uuid4())
    
    # Start the background task
    background_tasks.add_task(
        clipper_service.process_clip_job,
        job_id=job_id,
        request=request
    )
    
    return {
        "job_id": job_id,
        "status": "accepted",
        "message": "Clip job started",
        "check_status": f"/api/clip/{job_id}"
    }

@router.get("/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get the status of a clip job."""
    job = clipper_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/jobs", response_model=List[JobStatus])
async def list_jobs():
    """List all clip jobs."""
    return clipper_service.list_jobs()

@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: str):
    """Delete a clip job."""
    if not clipper_service.delete_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return None

@router.post("/test-webhook", status_code=200)
async def test_webhook(webhook: WebhookConfig):
    """Test a webhook configuration by sending a test payload."""
    test_payload = WebhookPayload(
        event="test",
        job_id="test-job-123",
        status="test",
        video_id="test-video-123",
        video_url="https://youtube.com/watch?v=test-video-123",
        timestamp=datetime.utcnow().isoformat()
    )
    
    success = await clipper_service.send_webhook(webhook, test_payload)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to send test webhook. Check the server logs for more details."
        )
    
    return {
        "status": "success",
        "message": "Test webhook sent successfully",
        "payload": test_payload.dict()
    }
