# app/api/ai.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Any, Dict, Optional
from app.supabase_client import get_supabase
from app.auth import get_current_user
from app.services.analyze import SermonAnalyzer

router = APIRouter(prefix="/ai", tags=["ai"])

class GenerateRequest(BaseModel):
    videoTitle: str
    videoDescription: Optional[str] = None
    preacherName: Optional[str] = None

class UpdateVideoContentRequest(BaseModel):
    videoId: str
    sermon_notes: Optional[List[str]] = None
    scripture_references: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None

@router.post("/generate-sermon-notes")
async def generate_sermon_notes(req: GenerateRequest):
    """Generate sermon tags, notes, references from title/description."""
    try:
        analyzer = SermonAnalyzer()
        # Build a small pseudo-transcription from provided metadata
        synthetic_text = f"Title: {req.videoTitle}. "
        if req.preacherName:
            synthetic_text += f"Preacher: {req.preacherName}. "
        if req.videoDescription:
            synthetic_text += f"Description: {req.videoDescription}. "
        result = analyzer.analyze(synthetic_text)
        # Ensure keys exist
        return {
            "tags": result.get("tags", []),
            "sermon_notes": result.get("sermon_notes", []),
            "scripture_references": result.get("scripture_references", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate content: {e}")

@router.post("/update-video-content")
async def update_video_content(req: UpdateVideoContentRequest, user=Depends(get_current_user)):
    """Persist generated AI content into the videos table."""
    try:
        supabase = get_supabase()
        update_fields: Dict[str, Any] = {}
        if req.sermon_notes is not None:
            update_fields["sermon_notes"] = req.sermon_notes
        if req.scripture_references is not None:
            update_fields["scripture_references"] = req.scripture_references
        if req.tags is not None:
            update_fields["tags"] = req.tags
        if not update_fields:
            return {"ok": True}
        res = supabase.table("videos").update(update_fields).eq("id", req.videoId).execute()
        return {"ok": True, "updated": len(res.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update video: {e}")
