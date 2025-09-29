# app/utils/files.py
import os
import re
from typing import Optional
from fastapi import UploadFile

INVALID_CHARS_PATTERN = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def safe_filename(title: Optional[str], default: str = "audio") -> str:
    raw = (title or default)
    name = INVALID_CHARS_PATTERN.sub('_', str(raw)).strip() or default
    # Collapse repeated underscores
    name = re.sub(r'_+', '_', name)
    # Limit length to avoid OS limits (reserve for extension)
    return name[:120]


def ensure_unique_path(directory: str, base_filename: str) -> str:
    os.makedirs(directory, exist_ok=True)
    dest = os.path.join(directory, base_filename)
    if not os.path.exists(dest):
        return dest
    name, ext = os.path.splitext(base_filename)
    counter = 1
    while True:
        candidate = os.path.join(directory, f"{name}_{counter}{ext}")
        if not os.path.exists(candidate):
            return candidate
        counter += 1


async def save_upload_file_async(upload_file: UploadFile, target_path: str) -> None:
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    try:
        with open(target_path, "wb") as buffer:
            while True:
                chunk = await upload_file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
    finally:
        await upload_file.close()
