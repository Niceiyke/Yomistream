# app/models/schemas.py
from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from fastapi import UploadFile

class ScriptureReference(BaseModel):
    reference: str
    text: str
    context: str


class SermonAnalysis(BaseModel):
    title: str
    summary: str
    sermon_notes: List[str]
    scripture_references: List[ScriptureReference]
    tags: List[str]
    transcription: Optional[str] = None
    duration: Optional[float] = None
    processed_at: str

class ProcessSermonRequest(BaseModel):
    source_type: str = Field(..., description="Source type: 'youtube' or 'audio'")
    youtube_url: Optional[HttpUrl] = None
    audio_file: Optional[UploadFile] = None
    language: str = "en"
    include_transcript: bool = False

    class Config:
        arbitrary_types_allowed = True

class YouTubeSermonRequest(BaseModel):
    youtube_url: HttpUrl
    language: str = "en"
    include_transcript: bool = False

class AudioSermonRequest(BaseModel):
    language: str = "en"
    include_transcript: bool = False

class TranscriptResponse(BaseModel):
    transcript: str
    language: str
    processed_at: str
