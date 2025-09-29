# app/services/downloader.py
import os
from typing import Optional, Tuple
import yt_dlp
import logging

logger = logging.getLogger(__name__)


def _format_ts(total_seconds: int) -> str:
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def download_audio(
    youtube_url: str,
    output_path_no_ext: str,
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
) -> Tuple[str, dict]:
    """
    Download audio from YouTube and return (audio_file_path, info).
    If start_time/end_time are provided (seconds), trim using multiple strategies
    to ensure the output mp3 is the desired segment.
    """
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': f"{output_path_no_ext}.%(ext)s",
        'quiet': True,
        'noplaylist': True,
    }

    if start_time is not None or end_time is not None:
        start_str = _format_ts(start_time) if start_time is not None else ''
        end_str = _format_ts(end_time) if end_time is not None else ''
        section_expr = f"*{start_str}-{end_str}"
        ydl_opts['download_sections'] = [{'section': section_expr}]
        ydl_opts['force_keyframes_at_cuts'] = True

        # External downloader trimming
        ydl_opts['external_downloader'] = 'ffmpeg'
        ed_args_i = []  # before input
        ed_args = []    # after input
        if start_time is not None:
            ed_args_i += ['-ss', start_str]
        if end_time is not None:
            ed_args += ['-to', end_str]
        if ed_args_i or ed_args:
            ydl_opts['external_downloader_args'] = {}
            if ed_args_i:
                ydl_opts['external_downloader_args']['ffmpeg_i'] = ed_args_i
            if ed_args:
                ydl_opts['external_downloader_args']['ffmpeg'] = ed_args

        # Postprocessor trimming for guaranteed final segment
        pp_args = []
        if start_time is not None:
            pp_args += ['-ss', start_str]
        if end_time is not None:
            pp_args += ['-to', end_str]
        if pp_args:
            ydl_opts['postprocessor_args'] = {'FFmpegExtractAudio': pp_args}

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            audio_file = ydl.prepare_filename(info)
            if not audio_file.endswith('.mp3'):
                audio_file = os.path.splitext(audio_file)[0] + '.mp3'
            # Fallback: find most recent mp3 in target directory if expected file not present
            if not os.path.exists(audio_file):
                candidate_dir = os.path.dirname(audio_file) or os.getcwd()
                mp3s = [
                    os.path.join(candidate_dir, f)
                    for f in os.listdir(candidate_dir)
                    if f.lower().endswith('.mp3')
                ]
                if mp3s:
                    audio_file = max(mp3s, key=lambda p: os.path.getmtime(p))
            return audio_file, info
    except Exception as e:
        logger.error(f"Error downloading audio: {str(e)}")
        raise
