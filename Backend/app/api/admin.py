# app/api/admin.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.supabase_client import get_supabase
from app.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

# ===== Schemas =====
class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    youtube_id: str
    topic: Optional[str] = None
    preacher_id: str
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = 0
    tags: Optional[list[str]] = []
    sermon_notes: Optional[list[str]] = []
    scripture_references: Optional[list[dict]] = []
    # New optional fields
    start_time_seconds: Optional[int] = None
    end_time_seconds: Optional[int] = None
    video_url: Optional[str] = None

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    youtube_id: Optional[str] = None
    topic: Optional[str] = None
    preacher_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    tags: Optional[list[str]] = None
    sermon_notes: Optional[list[str]] = None
    scripture_references: Optional[list[dict]] = None
    # New optional fields
    start_time_seconds: Optional[int] = None
    end_time_seconds: Optional[int] = None
    video_url: Optional[str] = None

class PreacherCreate(BaseModel):
    name: str
    bio: Optional[str] = None
    image_url: Optional[str] = None

class PreacherUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None

# ===== Middleware/Auth =====

def require_user(user=Depends(get_current_user)):
    return user

# ===== Videos =====
@router.get("/videos")
async def list_videos(user=Depends(require_user)):
    try:
        supabase = get_supabase()
        res = (
            supabase.table("videos")
            .select("*, preachers(name)")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list videos: {e}")

@router.post("/videos")
async def create_video(payload: VideoCreate, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        insert_data: Dict[str, Any] = payload.dict()
        # Provide default thumbnail if not provided
        if not insert_data.get("thumbnail_url") and insert_data.get("youtube_id"):
            insert_data["thumbnail_url"] = f"https://img.youtube.com/vi/{insert_data['youtube_id']}/maxresdefault.jpg"
        res = supabase.table("videos").insert(insert_data).execute()
        return {"ok": True, "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create video: {e}")

@router.put("/videos/{video_id}")
async def update_video(video_id: str, payload: VideoUpdate, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        res = supabase.table("videos").update(update_data).eq("id", video_id).execute()
        return {"ok": True, "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update video: {e}")

@router.delete("/videos/{video_id}")
async def delete_video(video_id: str, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        supabase.table("videos").delete().eq("id", video_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {e}")

# ===== Preachers =====
@router.get("/preachers")
async def list_preachers(user=Depends(require_user)):
    try:
        supabase = get_supabase()
        res = supabase.table("preachers").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list preachers: {e}")

@router.post("/preachers")
async def create_preacher(payload: PreacherCreate, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        res = supabase.table("preachers").insert(payload.dict()).execute()
        return {"ok": True, "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create preacher: {e}")

@router.put("/preachers/{preacher_id}")
async def update_preacher(preacher_id: str, payload: PreacherUpdate, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        res = supabase.table("preachers").update(update_data).eq("id", preacher_id).execute()
        return {"ok": True, "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preacher: {e}")

@router.delete("/preachers/{preacher_id}")
async def delete_preacher(preacher_id: str, user=Depends(require_user)):
    try:
        supabase = get_supabase()
        supabase.table("preachers").delete().eq("id", preacher_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete preacher: {e}")

# ===== Users & Stats =====
@router.get("/users")
async def list_users(user=Depends(require_user)):
    try:
        supabase = get_supabase()
        res = supabase.table("profiles").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {e}")

@router.get("/stats")
async def get_stats(user=Depends(require_user)):
    try:
        supabase = get_supabase()
        video_count = supabase.table("videos").select("id", count="exact").execute().count or 0
        preacher_count = supabase.table("preachers").select("id", count="exact").execute().count or 0
        user_count = supabase.table("profiles").select("id", count="exact").execute().count or 0
        collection_count = supabase.table("user_collections").select("id", count="exact").execute().count or 0
        return {
            "totalVideos": video_count,
            "totalPreachers": preacher_count,
            "totalUsers": user_count,
            "totalCollections": collection_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {e}")
