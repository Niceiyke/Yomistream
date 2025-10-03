# app/services/transcribe.py
import logging
import requests
from pathlib import Path
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class Transcriber:
    """Client wrapper that sends audio to a remote transcription API.

    The remote service is expected to accept a multipart/form-data POST with
    file field `file` and optionally `language`. It should return JSON with
    a top-level `text` field containing the transcript. This preserves the
    minimal contract used by the rest of the code.
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Transcriber, cls).__new__(cls)
        return cls._instance

    def transcribe_audio(self, audio_path: str, language: str = "en") -> Dict[str, Any]:
        if not settings.TRANSCRIBE_API_URL:
            raise RuntimeError("TRANSCRIBE_API_URL is not configured")

        url = settings.TRANSCRIBE_API_URL
        headers = {}
        if settings.TRANSCRIBE_API_KEY:
            headers["Authorization"] = f"Bearer {settings.TRANSCRIBE_API_KEY}"

        files = {"file": open(audio_path, "rb")}
        data = {"language": language}

        try:
            resp = requests.post(url, headers=headers, files=files, data=data, timeout=120)
            resp.raise_for_status()
            result = resp.json()

            # Expecting at least {'text': '...'} to match previous behavior
            if not isinstance(result, dict) or "text" not in result:
                logger.error(f"Unexpected transcription response: {result}")
                raise ValueError("Invalid response from transcription service")

            return result
        except Exception as e:
            logger.error(f"Error transcribing audio via remote API: {str(e)}")
            raise
        finally:
            try:
                files["file"].close()
            except Exception:
                pass