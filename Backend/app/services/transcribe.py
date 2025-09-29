# app/services/transcribe.py
import whisper
import logging
from pathlib import Path
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class Transcriber:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Transcriber, cls).__new__(cls)
            cls._instance.model = whisper.load_model(settings.WHISPER_MODEL)
        return cls._instance

    def transcribe_audio(self, audio_path: str, language: str = "en") -> Dict[str, Any]:
        try:
            result = self.model.transcribe(audio_path, language=language, fp16=False)
            return result
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            raise