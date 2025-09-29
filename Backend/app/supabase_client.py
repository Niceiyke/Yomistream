# app/supabase_client.py
from functools import lru_cache
from supabase import create_client, Client
from app.config import settings

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        raise RuntimeError("Supabase URL or Service Role Key not configured")
    return create_client(url, key)
