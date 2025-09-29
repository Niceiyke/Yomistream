# app/api/favorites.py
from fastapi import APIRouter, HTTPException, Depends
from app.supabase_client import get_supabase
from app.auth import get_current_user

router = APIRouter(prefix="/favorites", tags=["favorites"])

@router.get("")
async def get_user_favorites(user=Depends(get_current_user)):
    try:
        supabase = get_supabase()
        res = supabase.table("user_favorites").select("video_id").eq("user_id", user["id"]).execute()
        return {"video_ids": [row["video_id"] for row in (res.data or [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load favorites: {e}")

@router.post("")
async def add_favorite(payload: dict, user=Depends(get_current_user)):
    video_id = payload.get("video_id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")
    try:
        supabase = get_supabase()
        supabase.table("user_favorites").insert({
            "user_id": user["id"],
            "video_id": video_id,
        }).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add favorite: {e}")

@router.delete("/{video_id}")
async def remove_favorite(video_id: str, user=Depends(get_current_user)):
    try:
        supabase = get_supabase()
        supabase.table("user_favorites").delete().eq("user_id", user["id"]).eq("video_id", video_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove favorite: {e}")

# Preacher favorites
@router.get("/preachers")
async def get_preacher_favorites(user=Depends(get_current_user)):
    try:
        supabase = get_supabase()
        res = supabase.table("preacher_favorites").select("preacher_id").eq("user_id", user["id"]).execute()
        return {"preacher_ids": [row["preacher_id"] for row in (res.data or [])]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preacher favorites: {e}")

@router.post("/preachers")
async def add_preacher_favorite(payload: dict, user=Depends(get_current_user)):
    preacher_id = payload.get("preacher_id")
    if not preacher_id:
        raise HTTPException(status_code=400, detail="preacher_id is required")
    try:
        supabase = get_supabase()
        supabase.table("preacher_favorites").insert({
            "user_id": user["id"],
            "preacher_id": preacher_id,
        }).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add preacher favorite: {e}")

@router.delete("/preachers/{preacher_id}")
async def remove_preacher_favorite(preacher_id: str, user=Depends(get_current_user)):
    try:
        supabase = get_supabase()
        supabase.table("preacher_favorites").delete().eq("user_id", user["id"]).eq("preacher_id", preacher_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove preacher favorite: {e}")
