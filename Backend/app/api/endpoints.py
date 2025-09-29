# app/api/endpoints.py
import os
import shutil
import tempfile
import logging
from typing import Optional
from fastapi.responses import FileResponse
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form, status, Query
from app.models.schemas import SermonAnalysis, YouTubeSermonRequest, TranscriptResponse
from app.services.transcribe import Transcriber
from app.services.downloader import download_audio as download_audio_service
from app.services.sermon_processor import (
    process_sermon_task as process_sermon_task_service,
    process_audio_file as process_audio_file_service,
)
from app.utils.files import safe_filename, ensure_unique_path

logger = logging.getLogger(__name__)
router = APIRouter()
transcriber = Transcriber()


@router.post("/process-youtube", response_model=SermonAnalysis)
async def process_youtube_sermon(request: YouTubeSermonRequest,
    background_tasks: BackgroundTasks
):
    """Process a YouTube sermon by URL"""
    try:
        return await process_sermon_task_service(
            youtube_url=str(request.youtube_url),
            language=request.language,
            include_transcript=request.include_transcript
        )
    except Exception as e:
        logger.error(f"Error processing YouTube sermon: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process YouTube sermon: {str(e)}"
        )

@router.post("/process-audio", response_model=SermonAnalysis)
async def process_audio_sermon(
    audio_file: UploadFile = File(...),
    language: str = Form("en"),
    include_transcript: bool = Form(False)
):
    """Process an uploaded audio file"""
    try:
        return await process_audio_file_service(
            audio_file=audio_file,
            language=language,
            include_transcript=include_transcript
        )
    except Exception as e:
        logger.error(f"Error processing audio file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process audio file: {str(e)}"
        )


@router.post("/process-audio-only", response_model=TranscriptResponse)
async def transcribe_audio_only(
    audio_file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form("en", description="Language code of the audio content (e.g., 'en', 'es')")
) -> TranscriptResponse:
    """
    Transcribe an audio file and return only the transcript without any analysis.
    """
    try:
        # Save the uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as temp_file:
            shutil.copyfileobj(audio_file.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe the audio file
            logger.info(f"Transcribing audio file: {audio_file.filename}")
            transcription_result = transcriber.transcribe_audio(temp_file_path, language)
            
            if not transcription_result or "text" not in transcription_result:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Failed to transcribe audio: No text was returned"
                )
            
            # Return the transcript
            return TranscriptResponse(
                transcript=transcription_result["text"],
                language=language,
                processed_at=datetime.utcnow().isoformat()
            )
            
        finally:
            # Clean up the temporary file
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error in transcribe_audio_only: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing audio file: {str(e)}"
        )


@router.get("/download-audio")
async def download_audio_endpoint(
    youtube_url: str = Query(..., description="YouTube video URL"),
    start_time: Optional[int] = Query(None, description="Start time in seconds (optional)"),
    end_time: Optional[int] = Query(None, description="End time in seconds (optional)"),
    background_tasks: BackgroundTasks = None,
):
    """
    Download audio from a YouTube video and return it as a file.
    
    This endpoint only downloads the audio without any additional processing.
    """
    temp_dir = tempfile.mkdtemp()
    audio_file = None
    
    try:
        # Validate time range if provided
        if start_time is not None and start_time < 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="start_time must be >= 0")
        if end_time is not None and end_time <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end_time must be > 0")
        if start_time is not None and end_time is not None and end_time <= start_time:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end_time must be greater than start_time")

        # Download audio
        logger.info(f"Downloading audio from {youtube_url}")
        audio_path = os.path.join(temp_dir, "audio")
        
        try:
            audio_file, info = download_audio_service(
                youtube_url, 
                audio_path,
                start_time=start_time,
                end_time=end_time
            )
            
            if not os.path.exists(audio_file):
                raise FileNotFoundError(f"Audio file not found at {audio_file}")
            
            logger.info(f"Audio downloaded to {audio_file}")
            
            # Build a persistent, sanitized destination filename
            base_filename = f"{safe_filename(info.get('title'), 'audio')}.mp3"

            # Determine destination directory (env override allowed)
            dest_dir = os.environ.get('AUDIO_DOWNLOAD_DIR') or os.path.join(os.getcwd(), 'downloads')

            # Ensure unique filename to avoid overwriting
            dest_path = ensure_unique_path(dest_dir, base_filename)

            # Move the file to the persistent destination
            shutil.move(audio_file, dest_path)

            # Create response from the saved path
            response = FileResponse(
                dest_path,
                media_type="audio/mpeg",
                filename=os.path.basename(dest_path)
            )

            # Schedule cleanup for only the temporary directory (keep saved file)
            def cleanup():
                try:
                    if os.path.exists(temp_dir):
                        shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Error cleaning up temporary files: {str(e)}")

            if background_tasks is not None:
                background_tasks.add_task(cleanup)

            return response
            
        except Exception as e:
            logger.error(f"Error downloading audio: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to download audio: {str(e)}"
            )
            
    except Exception as e:
        logger.error(f"Error in download_audio_endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing your request: {str(e)}"
        )
    finally:
        # If background_tasks was not provided, still clean only the temp directory
        if background_tasks is None:
            try:
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Error cleaning up temporary files: {str(e)}")
