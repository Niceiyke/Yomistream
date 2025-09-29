# app/services/sermon_processor.py
import os
import tempfile
import shutil
import logging
from typing import Dict, Any
from datetime import datetime
from fastapi import UploadFile

from app.services.transcribe import Transcriber
from app.services.analyze import SermonAnalyzer
from app.services.downloader import download_audio as download_audio_service
from app.utils.files import save_upload_file_async

logger = logging.getLogger(__name__)

_transcriber = Transcriber()
_analyzer = SermonAnalyzer()


async def process_sermon_task(youtube_url: str, language: str, include_transcript: bool = False) -> Dict[str, Any]:
    """Download, transcribe, and analyze a YouTube sermon."""
    temp_dir = tempfile.mkdtemp()
    audio_file = None

    try:
        # Download audio
        logger.info(f"Downloading audio from {youtube_url}")
        audio_path = os.path.join(temp_dir, "audio")
        audio_file, info = download_audio_service(youtube_url, audio_path)

        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"Audio file not found at {audio_file}")
        logger.info(f"Audio downloaded to {audio_file}")

        # Metadata
        title = info.get('title', 'Untitled Sermon')
        duration = info.get('duration')

        # Transcribe
        logger.info("Transcribing audio...")
        transcription_result = _transcriber.transcribe_audio(audio_file, language)
        if not transcription_result or "text" not in transcription_result:
            raise ValueError("Failed to transcribe audio: No text returned")
        transcription = transcription_result["text"]

        # Analyze
        logger.info("Analyzing sermon content...")
        analysis = _analyzer.analyze(transcription, duration)

        return {
            "title": analysis.get("title", title),
            "summary": analysis.get("summary", ""),
            "sermon_notes": analysis.get("sermon_notes", []),
            "scripture_references": analysis.get("scripture_references", []),
            "tags": analysis.get("tags", []),
            "duration": duration,
            "processed_at": datetime.utcnow().isoformat(),
            "transcription": transcription if include_transcript else None,
        }
    finally:
        # Cleanup
        try:
            if audio_file and os.path.exists(audio_file):
                os.remove(audio_file)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {str(e)}")


async def process_audio_file(audio_file: UploadFile, language: str, include_transcript: bool) -> Dict[str, Any]:
    """Transcribe and analyze an uploaded audio file."""
    temp_dir = tempfile.mkdtemp()
    temp_audio_path = os.path.join(temp_dir, audio_file.filename or "audio.mp3")

    try:
        # Save the uploaded file
        await save_upload_file_async(audio_file, temp_audio_path)
        logger.info(f"Audio file saved to {temp_audio_path}")

        # Transcribe
        logger.info("Transcribing audio...")
        transcription_result = _transcriber.transcribe_audio(temp_audio_path, language)
        if not transcription_result or "text" not in transcription_result:
            raise ValueError("Failed to transcribe audio: No text returned")
        transcription = transcription_result["text"]

        # Analyze
        logger.info("Analyzing sermon content...")
        analysis = _analyzer.analyze(transcription)

        return {
            "title": analysis.get("title", "Sermon"),
            "summary": analysis.get("summary", ""),
            "sermon_notes": analysis.get("sermon_notes", []),
            "scripture_references": analysis.get("scripture_references", []),
            "tags": analysis.get("tags", []),
            "duration": None,
            "processed_at": datetime.utcnow().isoformat(),
            "transcription": transcription if include_transcript else None,
        }
    finally:
        # Cleanup
        try:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {str(e)}")
