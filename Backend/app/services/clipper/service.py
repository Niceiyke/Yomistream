import os
import uuid
import logging
import asyncio
import sqlite3
import subprocess
import httpx
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, HttpUrl, validator
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
import pickle
from datetime import datetime
from PIL import Image, ImageOps
import io

logger = logging.getLogger(__name__)

# Constants
THUMBNAIL_MAX_SIZE = 2 * 1024 * 1024  # 2MB
THUMBNAIL_DIM = (1280, 720)
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

class WebhookConfig(BaseModel):
    url: HttpUrl
    events: List[str] = ["completed", "failed"]
    headers: Optional[dict] = None

class ClipRequest(BaseModel):
    video_url: HttpUrl
    start_time: str
    end_time: str
    title: str = "Clipped Video"
    description: str = "This is a clipped segment."
    tags: List[str] = ["clip"]
    category_id: str = "22"
    privacy_status: str = "unlisted"
    webhook: Optional[WebhookConfig] = None

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class WebhookPayload(BaseModel):
    event: str
    job_id: str
    status: str
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    timestamp: str

class ClipperService:
    def __init__(self, temp_dir: str = "temp", uploads_dir: str = "uploads", db_path: str = None):
        # Initialize directories
        self.temp_dir = Path(temp_dir)
        self.uploads_dir = Path(uploads_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        
        # Database setup - use a data directory in the backend root
        self.db_path = db_path or str(Path(__file__).parent.parent.parent / 'data' / 'clipper_jobs.db')
        
        # Ensure the data directory exists
        db_dir = Path(self.db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Using database at: {self.db_path}")
        self._init_db()
        
        # OAuth2 credentials
        self.credentials_file = "credentials.json"
        self.token_file = "token.pickle"
    
    def _get_db_conn(self):
        """Get a database connection."""
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        """Initialize the database with required tables."""
        with self._get_db_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT,
                    progress TEXT,
                    video_id TEXT,
                    video_url TEXT,
                    error TEXT,
                    created_at TEXT,
                    completed_at TEXT
                )
            """)
            conn.commit()
    
    def _create_job_record(self, job_id: str) -> None:
        """Create a new job record in the database."""
        with self._get_db_conn() as conn:
            conn.execute(
                """
                INSERT INTO jobs (job_id, status, progress, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (job_id, "pending", "0%", datetime.utcnow().isoformat())
            )
            conn.commit()
    
    def _update_job_record(
        self,
        job_id: str,
        status: str = None,
        progress: str = None,
        video_id: str = None,
        video_url: str = None,
        error: str = None
    ) -> None:
        """Update a job record in the database."""
        updates = []
        params = {}
        
        if status is not None:
            updates.append("status = :status")
            params["status"] = status
        if progress is not None:
            updates.append("progress = :progress")
            params["progress"] = progress
        if video_id is not None:
            updates.append("video_id = :video_id")
            params["video_id"] = video_id
        if video_url is not None:
            updates.append("video_url = :video_url")
            params["video_url"] = video_url
        if error is not None:
            updates.append("error = :error")
            params["error"] = error
        if status in ["completed", "failed"]:
            updates.append("completed_at = :completed_at")
            params["completed_at"] = datetime.utcnow().isoformat()
        
        if not updates:
            return
            
        query = f"""
            UPDATE jobs 
            SET {', '.join(updates)}
            WHERE job_id = :job_id
        """
        params["job_id"] = job_id
        
        with self._get_db_conn() as conn:
            conn.execute(query, params)
            conn.commit()
    
    def _get_job_record(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a job record from the database."""
        with self._get_db_conn() as conn:
            cursor = conn.execute(
                "SELECT * FROM jobs WHERE job_id = ?",
                (job_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    async def send_webhook(self, webhook_config: WebhookConfig, payload: WebhookPayload):
        """Send a webhook notification with the given payload."""
        try:
            headers = webhook_config.headers or {}
            headers["Content-Type"] = "application/json"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    str(webhook_config.url),
                    json=payload.dict(),
                    headers=headers,
                    timeout=10.0
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to send webhook: {str(e)}")
            return False

    def update_job_status(self, job_id: str, status: str, progress: str, 
                         video_id: str = None, video_url: str = None, error: str = None) -> dict:
        """Update the status of a job."""
        # First, try to get the existing job
        job = self._get_job_record(job_id)
        
        if job is None:
            # Create a new job record if it doesn't exist
            self._create_job_record(job_id)
            created_at = datetime.utcnow().isoformat()
        else:
            created_at = job.get("created_at")
        
        # Update the job record in the database
        self._update_job_record(
            job_id=job_id,
            status=status,
            progress=progress,
            video_id=video_id,
            video_url=video_url,
            error=error
        )
        
        # Return the updated job
        updated_job = self._get_job_record(job_id)
        if updated_job is None:
            raise ValueError(f"Failed to update job {job_id}")
            
        return updated_job

    def cleanup_files(self, *files):
        """Clean up temporary files."""
        for file in files:
            try:
                if file and os.path.exists(file):
                    os.remove(file)
                    logger.info(f"Cleaned up file: {file}")
            except Exception as e:
                logger.error(f"Error cleaning up file {file}: {str(e)}")

    def get_youtube_service(self):
        """Get an authenticated YouTube API service."""
        credentials = None
        
        if os.path.exists(self.token_file):
            with open(self.token_file, 'rb') as token:
                credentials = pickle.load(token)
        
        if not credentials or not credentials.valid:
            if credentials and credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file,
                    ['https://www.googleapis.com/auth/youtube.upload']
                )
                credentials = flow.run_local_server(port=0)
            
            with open(self.token_file, 'wb') as token:
                pickle.dump(credentials, token)
        
        return build('youtube', 'v3', credentials=credentials)

    async def download_video(self, url: HttpUrl, output: str, job_id: str):
        """Download a video from a URL using yt-dlp."""
        self.update_job_status(job_id, "downloading", "Starting download...")
        
        # Try multiple strategies for downloading
        strategies = [
            # Strategy 1: Android client with headers
            [
                'yt-dlp',
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                '-o', output,
                '--no-warnings',
                '--no-check-certificate',
                '--extractor-args', 'youtube:player_client=android',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                '--referer', 'https://www.youtube.com/',
                '--add-header', 'Accept-Language:en-US,en;q=0.9',
                str(url)
            ],
            # Strategy 2: TV client (often less restricted)
            [
                'yt-dlp',
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                '-o', output,
                '--no-warnings',
                '--no-check-certificate',
                '--extractor-args', 'youtube:player_client=tv_embedded',
                '--user-agent', 'Mozilla/5.0 (Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
                str(url)
            ],
            # Strategy 3: Basic approach with different user agent
            [
                'yt-dlp',
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                '-o', output,
                '--no-warnings',
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                str(url)
            ]
        ]
        
        for i, cmd in enumerate(strategies, 1):
            try:
                self.update_job_status(job_id, "downloading", f"Trying download strategy {i}...")
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0:
                    self.update_job_status(job_id, "downloading", "Download completed")
                    return True
                else:
                    error_msg = f"Strategy {i} failed with return code {process.returncode}: {stderr.decode().strip()}"
                    logger.warning(error_msg)
                    if i == len(strategies):  # Last strategy failed
                        self.update_job_status(job_id, "failed", "All download strategies failed", error=error_msg)
                        return False
                    # Continue to next strategy
                    continue
                    
            except Exception as e:
                error_msg = f"Strategy {i} failed with exception: {str(e)}"
                logger.warning(error_msg)
                if i == len(strategies):  # Last strategy failed
                    self.update_job_status(job_id, "failed", "All download strategies failed", error=error_msg)
                    return False
                # Continue to next strategy
                continue
        
        # This should never be reached, but just in case
        return False

    async def trim_video(self, input_file: str, output_file: str, start: str, 
                        end: str, job_id: str) -> bool:
        """Trim a video using ffmpeg."""
        self.update_job_status(job_id, "trimming", "Starting video trimming...")
        
        try:
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output file if it exists
                '-i', input_file,
                '-ss', start,
                '-to', end,
                '-c', 'copy',  # Use stream copy for no re-encoding
                output_file
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = f"Trimming failed with return code {process.returncode}: {stderr.decode().strip()}"
                logger.error(error_msg)
                self.update_job_status(job_id, "failed", "Trimming failed", error=error_msg)
                return False
                
            self.update_job_status(job_id, "trimming", "Video trimming completed")
            return True
            
        except Exception as e:
            error_msg = f"Error during trimming: {str(e)}"
            logger.error(error_msg)
            self.update_job_status(job_id, "failed", "Trimming error", error=error_msg)
            return False

    async def upload_video(self, youtube, file: str, title: str, description: str, 
                          tags: List[str], category: str, privacy: str, job_id: str) -> Optional[str]:
        """Upload a video to YouTube."""
        self.update_job_status(job_id, "uploading", "Starting video upload...")
        
        try:
            request_body = {
                'snippet': {
                    'title': title,
                    'description': description,
                    'tags': tags,
                    'categoryId': category
                },
                'status': {
                    'privacyStatus': privacy,
                    'selfDeclaredMadeForKids': False
                }
            }
            
            media = MediaFileUpload(file, chunksize=-1, resumable=True)
            
            request = youtube.videos().insert(
                part=','.join(request_body.keys()),
                body=request_body,
                media_body=media
            )
            
            response = None
            while response is None:
                status, response = request.next_chunk()
                if status:
                    progress = int(status.progress() * 100)
                    self.update_job_status(job_id, "uploading", f"Uploading... {progress}%")
            
            video_id = response.get('id')
            video_url = f"https://youtube.com/watch?v={video_id}"
            
            self.update_job_status(
                job_id, 
                "completed", 
                "Upload completed", 
                video_id=video_id,
                video_url=video_url
            )
            
            return video_id
            
        except HttpError as e:
            error_msg = f"YouTube API error: {str(e)}"
            logger.error(error_msg)
            self.update_job_status(job_id, "failed", "Upload failed", error=error_msg)
            return None
        except Exception as e:
            error_msg = f"Error during upload: {str(e)}"
            logger.error(error_msg)
            self.update_job_status(job_id, "failed", "Upload error", error=error_msg)
            return None

    async def process_clip_job(self, job_id: str, request: ClipRequest) -> bool:
        """Process a clip job asynchronously."""
        self.update_job_status(job_id, "processing", "Starting job...")
        
        # Generate unique filenames
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        download_path = self.temp_dir / f"{job_id}_original_{timestamp}.mp4"
        output_path = self.uploads_dir / f"{job_id}_clipped_{timestamp}.mp4"
        
        try:
            # Download the video
            if not await self.download_video(request.video_url, str(download_path), job_id):
                return False
            
            # Trim the video
            if not await self.trim_video(
                str(download_path), 
                str(output_path), 
                request.start_time, 
                request.end_time,
                job_id
            ):
                return False
            
            # Upload to YouTube
            youtube = self.get_youtube_service()
            video_id = await self.upload_video(
                youtube,
                str(output_path),
                request.title,
                request.description,
                request.tags,
                request.category_id,
                request.privacy_status,
                job_id
            )
            
            if not video_id:
                return False
            
            # Send webhook if configured
            if request.webhook:
                payload = WebhookPayload(
                    event="completed",
                    job_id=job_id,
                    status="completed",
                    video_id=video_id,
                    video_url=f"https://youtube.com/watch?v={video_id}",
                    timestamp=datetime.utcnow().isoformat()
                )
                await self.send_webhook(request.webhook, payload)
            
            return True
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            self.update_job_status(job_id, "failed", "Processing failed", error=error_msg)
            
            # Send failure webhook if configured
            if request.webhook:
                payload = WebhookPayload(
                    event="failed",
                    job_id=job_id,
                    status="failed",
                    error=error_msg,
                    timestamp=datetime.utcnow().isoformat()
                )
                await self.send_webhook(request.webhook, payload)
            
            return False
            
        finally:
            # Clean up temporary files
            self.cleanup_files(download_path, output_path)

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a job."""
        with self._get_db_conn() as conn:
            cursor = conn.execute(
                """
                SELECT * FROM jobs 
                WHERE job_id = ?
                """,
                (job_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all jobs from the database."""
        with self._get_db_conn() as conn:
            cursor = conn.execute(
                """
                SELECT * FROM jobs 
                ORDER BY datetime(created_at) DESC
                """
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def delete_job(self, job_id: str) -> bool:
        """Delete a job."""
        with self._get_db_conn() as conn:
            cursor = conn.execute(
                """
                DELETE FROM jobs 
                WHERE job_id = ?
                """,
                (job_id,)
            )
            if cursor.rowcount > 0:
                return True
            return False
        return False
