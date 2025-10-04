print("=== Clipper module is being imported ===")
import os
import subprocess
import uuid
import pickle
import sqlite3
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import httpx
try:
    from PIL import Image
    import io
except Exception:
    Image = None
    import io

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'clipper_jobs.db')
DB_PATH = os.path.abspath(DB_PATH)
print("DB_PATH",DB_PATH)
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TEMP_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'temp')
os.makedirs(TEMP_DIR, exist_ok=True)
THUMBNAIL_MAX_SIZE = 2 * 1024 * 1024  # 2MB
THUMBNAIL_DIM = (1280, 720)


def get_db_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        """
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
        """
    )
    conn.commit()
    conn.close()


def create_job_record(job_id: str, created_at: Optional[str] = None) -> None:
    created_at = created_at or datetime.now().isoformat()
    conn = get_db_conn()
    conn.execute(
        "INSERT INTO jobs (job_id, status, progress, video_id, video_url, error, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (job_id, 'pending', 'Job created', None, None, None, created_at, None)
    )
    conn.commit()
    conn.close()


def update_job_record(job_id: str, status: str, progress: str, video_id: Optional[str] = None, error: Optional[str] = None):
    completed_at = datetime.now().isoformat() if status in ("completed", "failed") else None
    video_url = f"https://youtube.com/watch?v={video_id}" if video_id else None
    conn = get_db_conn()
    conn.execute(
        "UPDATE jobs SET status=?, progress=?, video_id=?, video_url=?, error=?, completed_at=? WHERE job_id=?",
        (status, progress, video_id, video_url, error, completed_at, job_id)
    )
    conn.commit()
    conn.close()


def get_job_record(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_conn()
    cur = conn.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    # convert sqlite.Row to plain dict with string keys
    return {k: (row[k] if row[k] is not None else None) for k in row.keys()}


def list_jobs(limit: int = 100) -> List[Dict[str, Any]]:
    print("DB_PATH",DB_PATH)
    conn = get_db_conn()
    cur = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_job_record(job_id: str) -> None:
    conn = get_db_conn()
    conn.execute("DELETE FROM jobs WHERE job_id=?", (job_id,))
    conn.commit()
    conn.close()


def get_youtube_service():
    if not os.path.exists("client_secret.json"):
        raise Exception("Missing client_secret.json file")
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("client_secret.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)
    return build("youtube", "v3", credentials=creds)


def run_subprocess(cmd: list) -> bool:
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


async def send_webhook(url: str, payload: dict, headers: Optional[dict] = None):
    headers = headers or {}
    headers["Content-Type"] = "application/json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            logger.info("Webhook sent to %s", url)
    except Exception as e:
        logger.warning("Webhook failed: %s", e)


def download_video(url: str, output: str, max_retries: int = 3) -> bool:
    """Download a video using yt-dlp with browser cookies for authentication.
    
    Args:
        url: The video URL to download
        output: Output file path template
        max_retries: Maximum number of retry attempts
        
    Returns:
        bool: True if download was successful, False otherwise
    """
    # Try with cookies from common browsers first
    browsers = ["chrome", "firefox", "edge", "safari"]
    
    for attempt in range(max_retries):
        for browser in browsers:
            try:
                cmd = [
                    "yt-dlp",
                    "--cookies-from-browser", browser,
                    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                    "-o", output,
                    "--no-warnings",
                    "--retries", "10",
                    "--fragment-retries", "10",
                    "--extractor-retries", "10",
                    "--socket-timeout", "30",
                    "--source-address", "0.0.0.0",
                    url
                ]
                
                if run_subprocess(cmd):
                    return True
                    
            except Exception as e:
                logger.warning(f"Download attempt {attempt + 1} with {browser} failed: {str(e)}")
                continue
    
    # If all browser attempts fail, try without cookies as fallback
    logger.warning("All browser cookie attempts failed, trying without cookies")
    return run_subprocess([
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", output,
        "--no-warnings",
        "--retries", "5",
        url
    ])


def trim_video(input_file: str, output_file: str, start: str, end: str) -> bool:
    return run_subprocess(["ffmpeg", "-i", input_file, "-ss", start, "-to", end, "-c", "copy", output_file, "-y"])


def download_image(url: str) -> Optional[bytes]:
    try:
        r = httpx.get(url, timeout=10.0)
        r.raise_for_status()
        return r.content
    except Exception:
        return None


def generate_thumbnail_from_video(video_path: str, out_path: str, timecode: str = "00:00:02") -> bool:
    # Extract frame using ffmpeg to a PNG, then resize/compress with Pillow
    if Image is None:
        logger.warning("Pillow not installed; skipping thumbnail generation")
        return False
    tmp_png = out_path + ".png"
    if not run_subprocess(["ffmpeg", "-i", video_path, "-ss", timecode, "-vframes", "1", tmp_png, "-y"]):
        return False
    try:
        with Image.open(tmp_png) as im:
            im = im.convert("RGB")
            im.thumbnail(THUMBNAIL_DIM)
            # save as JPEG to out_path
            im.save(out_path, format="JPEG", quality=85)
        # remove tmp png
        try:
            os.remove(tmp_png)
        except Exception:
            pass
        # ensure size limit
        if os.path.getsize(out_path) > THUMBNAIL_MAX_SIZE:
            # try re-saving with lower quality
            with Image.open(out_path) as im:
                im.save(out_path, format="JPEG", quality=70)
        return True
    except Exception:
        try:
            if os.path.exists(tmp_png):
                os.remove(tmp_png)
        except Exception:
            pass
        return False


def save_image_bytes(image_bytes: bytes, out_path: str) -> bool:
    if Image is None:
        logger.warning("Pillow not installed; cannot save image bytes")
        return False
    try:
        im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        im.thumbnail(THUMBNAIL_DIM)
        im.save(out_path, format="JPEG", quality=85)
        if os.path.getsize(out_path) > THUMBNAIL_MAX_SIZE:
            im = Image.open(out_path)
            im.save(out_path, format="JPEG", quality=70)
        return True
    except Exception:
        return False


def set_thumbnail(youtube, video_id: str, thumbnail_path: str) -> bool:
    try:
        media = MediaFileUpload(thumbnail_path)
        request = youtube.thumbnails().set(videoId=video_id, media_body=media)
        response = request.execute()
        return True
    except HttpError as e:
        logger.warning("Thumbnail upload failed: %s", e)
        return False


def upload_video(youtube, file: str, title: str, description: str, tags: List[str], category: str, privacy: str, progress_callback=None):
    body = {"snippet": {"title": title, "description": description, "tags": tags, "categoryId": category}, "status": {"privacyStatus": privacy}}
    try:
        media = MediaFileUpload(file, chunksize=1024*1024, resumable=True)
        request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status and progress_callback:
                progress_callback(int(status.progress() * 100))
        return response
    except HttpError as e:
        raise Exception(f"Upload failed: {str(e)}")


async def process_clip_job(job_id: str, request: Dict[str, Any]):
    # request: dict with keys matching ClipRequest fields
    temp_video = os.path.join(TEMP_DIR, f"{job_id}_original.mp4")
    clipped_video = os.path.join(TEMP_DIR, f"{job_id}_clipped.mp4")
    try:
        update_job_record(job_id, "processing", "Downloading video...")
        if not download_video(request["video_url"], temp_video):
            raise Exception("Failed to download video")

        update_job_record(job_id, "processing", "Trimming video...")
        if not trim_video(temp_video, clipped_video, request["start_time"], request["end_time"]):
            raise Exception("Failed to trim video")

        update_job_record(job_id, "processing", "Authenticating to YouTube...")
        youtube = get_youtube_service()

        def progress_cb(p):
            update_job_record(job_id, "processing", f"Uploading: {p}%")

        response = upload_video(youtube, clipped_video, request.get("title", "Clipped Video"), request.get("description", ""), request.get("tags", ["clip"]), request.get("category_id", "22"), request.get("privacy_status", "unlisted"), progress_callback=progress_cb)
        video_id = response.get("id")

        # thumbnail handling: prefer user-supplied thumbnail_url, else auto-generate
        thumbnail_path = None
        thumb_bytes = None
        thumb_bytes = None
        if request.get("thumbnail_url"):
            thumb_bytes = download_image(str(request.get("thumbnail_url")))
        if thumb_bytes:
            thumbnail_path = os.path.join(TEMP_DIR, f"{job_id}_thumb.jpg")
            if save_image_bytes(thumb_bytes, thumbnail_path):
                set_thumbnail(youtube, video_id, thumbnail_path)
        else:
            # try auto-generate from clipped video
            thumbnail_path = os.path.join(TEMP_DIR, f"{job_id}_thumb.jpg")
            if generate_thumbnail_from_video(clipped_video, thumbnail_path):
                set_thumbnail(youtube, video_id, thumbnail_path)

        update_job_record(job_id, "completed", "Upload successful!", video_id=video_id)

        # send webhook if present
        webhook = request.get("webhook")
        if webhook:
            payload = {"event": "completed", "job_id": job_id, "status": "completed", "video_id": video_id, "video_url": f"https://youtube.com/watch?v={video_id}", "error": None, "timestamp": datetime.now().isoformat()}
            await send_webhook(webhook.get("url"), payload, webhook.get("headers"))

    except Exception as e:
        error_msg = str(e)
        update_job_record(job_id, "failed", "Error occurred", error=error_msg)
        webhook = request.get("webhook")
        if webhook:
            payload = {"event": "failed", "job_id": job_id, "status": "failed", "video_id": None, "video_url": None, "error": error_msg, "timestamp": datetime.now().isoformat()}
            await send_webhook(webhook.get("url"), payload, webhook.get("headers"))
    finally:
        for f in (temp_video, clipped_video):
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass
