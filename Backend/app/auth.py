# app/auth.py
import time
from typing import Optional
import httpx
from jose import jwt, jwk
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from functools import lru_cache
from app.config import settings

security = HTTPBearer(auto_error=False)

@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    if not settings.SUPABASE_JWKS_URL:
        raise RuntimeError("SUPABASE_JWKS_URL is not set")
    resp = httpx.get(settings.SUPABASE_JWKS_URL, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _get_public_key_pem(token: str) -> Optional[str]:
    # Get kid from token header and match to JWKS
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    jwks = _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            key_obj = jwk.construct(key)
            pem = key_obj.to_pem().decode()
            return pem
    return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None or not credentials.scheme.lower() == "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        # Try RS256 via JWKS first
        try:
            public_key = _get_public_key_pem(token)
            if public_key:
                claims = jwt.decode(token, public_key, algorithms=["RS256"], options={"verify_aud": False})
            else:
                raise Exception("No matching JWKS key")
        except Exception:
            # Fallback to HS256 using SUPABASE_JWT_SECRET (common in Supabase setups)
            if not getattr(settings, "SUPABASE_JWT_SECRET", None):
                raise
            claims = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        # Basic expiry check
        if claims.get("exp") and time.time() > float(claims["exp"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        user_id = claims.get("sub") or claims.get("user_id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")
        return {"id": user_id, "claims": claims}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
