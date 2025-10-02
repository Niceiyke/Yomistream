import os
import subprocess
import sys
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
import pickle

# ===== CONFIG =====
VIDEO_URL = "https://www.youtube.com/watch?v=oj65QrWLEtg&t"
START_TIME = "00:48:06"   # hh:mm:ss
END_TIME = "01:33:10"     # hh:mm:ss
OUTPUT_FILE = "clipped.mp4"
TEMP_FILE = "video.mp4"

# Video metadata
VIDEO_TITLE = "THE INSTRUMENT RATED CHRISTIAN: PROSPERITY "
VIDEO_DESCRIPTION = "THE INSTRUMENT RATED CHRISTIAN: PROSPERITY || 2ND SERVICE | SEPT, 28TH 2025 | PASTOR POJU OYEMADE."
VIDEO_TAGS = ["THE INSTRUMENT RATED CHRISTIAN", "PASTOR POJU OYEMADE"]
VIDEO_CATEGORY = "22"  # People & Blogs
PRIVACY_STATUS = "unlisted"  # "public", "private", or "unlisted"

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

# ===== HELPER FUNCTIONS =====
def check_dependencies():
    """Check if required tools are installed."""
    tools = ["yt-dlp", "ffmpeg"]
    missing = []
    for tool in tools:
        try:
            subprocess.run([tool, "--version"], 
                         stdout=subprocess.DEVNULL, 
                         stderr=subprocess.DEVNULL)
        except FileNotFoundError:
            missing.append(tool)
    
    if missing:
        print(f"❌ Missing required tools: {', '.join(missing)}")
        print("Install with:")
        print("  pip install yt-dlp")
        print("  - FFmpeg: https://ffmpeg.org/download.html")
        sys.exit(1)

def cleanup_files(*files):
    """Remove temporary files."""
    for file in files:
        if os.path.exists(file):
            try:
                os.remove(file)
                print(f"🗑️  Cleaned up {file}")
            except Exception as e:
                print(f"⚠️  Could not remove {file}: {e}")

# ===== STEP 1: Download video =====
def download_video(url, output):
    """Download video from YouTube."""
    print("📥 Downloading video...")
    try:
        subprocess.run([
            "yt-dlp", 
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "-o", output,
            url
        ], check=True)
        print("✅ Download complete!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Download failed: {e}")
        return False

# ===== STEP 2: Trim video =====
def trim_video(input_file, output_file, start, end):
    """Trim video using FFmpeg."""
    print("✂️  Trimming video...")
    try:
        # Using -c copy for fast processing (stream copy)
        # Use -c:v libx264 -c:a aac if you need frame-accurate cuts
        subprocess.run([
            "ffmpeg", 
            "-i", input_file,
            "-ss", start, 
            "-to", end,
            "-c", "copy",  # Fast but less accurate
            # "-c:v", "libx264", "-c:a", "aac",  # Slower but accurate
            output_file, 
            "-y"
        ], check=True, stderr=subprocess.DEVNULL)
        print("✅ Trimming complete!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Trimming failed: {e}")
        return False

# ===== STEP 3: Authenticate with YouTube API =====
def get_youtube_service():
    """Authenticate and return YouTube API service."""
    print("🔐 Authenticating with YouTube...")
    
    if not os.path.exists("client_secret.json"):
        print("❌ Missing client_secret.json")
        print("Get it from: https://console.cloud.google.com/")
        sys.exit(1)
    
    creds = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "client_secret.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)
    
    print("✅ Authentication successful!")
    return build("youtube", "v3", credentials=creds)

# ===== STEP 4: Upload video =====
def upload_video(youtube, file, title, description, tags, category, privacy):
    """Upload video to YouTube with progress tracking."""
    print("📤 Uploading video to YouTube...")
    
    if not os.path.exists(file):
        print(f"❌ File not found: {file}")
        return None
    
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category
        },
        "status": {
            "privacyStatus": privacy
        }
    }
    
    try:
        media = MediaFileUpload(file, chunksize=1024*1024, resumable=True)
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                print(f"📊 Upload progress: {progress}%")
        
        print("✅ Upload complete!")
        return response
    
    except HttpError as e:
        print(f"❌ Upload failed: {e}")
        return None

# ===== MAIN EXECUTION =====
def main():
    print("🎬 YouTube Video Clipper & Uploader")
    print("=" * 50)
    
    # Check dependencies
    check_dependencies()
    
    # Step 1: Download
    if not download_video(VIDEO_URL, TEMP_FILE):
        sys.exit(1)
    
    # Step 2: Trim
    if not trim_video(TEMP_FILE, OUTPUT_FILE, START_TIME, END_TIME):
        cleanup_files(TEMP_FILE)
        sys.exit(1)
    
    # Step 3: Authenticate
    try:
        youtube = get_youtube_service()
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        cleanup_files(TEMP_FILE, OUTPUT_FILE)
        sys.exit(1)
    
    # Step 4: Upload
    response = upload_video(
        youtube, 
        OUTPUT_FILE, 
        VIDEO_TITLE,
        VIDEO_DESCRIPTION,
        VIDEO_TAGS,
        VIDEO_CATEGORY,
        PRIVACY_STATUS
    )
    
    if response:
        video_id = response["id"]
        print(f"\n🎉 Success! Video ID: {video_id}")
        print(f"🔗 Watch here: https://youtube.com/watch?v={video_id}")
    else:
        print("\n❌ Upload failed.")
    
    # Cleanup
    print("\n🧹 Cleaning up temporary files...")
    cleanup_files(TEMP_FILE, OUTPUT_FILE)
    
    print("\n✨ Done!")

if __name__ == "__main__":
    main()