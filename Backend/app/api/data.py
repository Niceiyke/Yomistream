# app/api/data.py
from fastapi import APIRouter, HTTPException
from app.supabase_client import get_supabase

router = APIRouter(prefix="/data", tags=["data"])

@router.get("/videos")
async def list_videos():
    try:
        supabase = get_supabase()
        # Select videos with preacher relation, newest first
        res = supabase.table("videos").select("*, preacher:preachers(*)").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load videos: {e}")

@router.get("/preachers")
async def list_preachers():
    try:
        supabase = get_supabase()
        res = supabase.table("preachers").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preachers: {e}")
