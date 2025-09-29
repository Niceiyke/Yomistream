# app/services/analyze.py
import json
import logging
from typing import Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

class SermonAnalyzer:
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)

    def analyze(self, transcription: str, duration: float = None) -> Dict[str, Any]:
        prompt = f"""
        You are an assistant that analyzes Christian sermon transcripts and produces a structured JSON object. Follow these instructions:

        Return ONLY valid JSON (no Markdown code fences, no extra text) with these keys:

        - "title": A concise, meaningful title (string)
        - "summary": A brief 2–3 sentence summary (string)
        - "sermon_notes": A list of 5–10 key sermon points (array of strings)
        - "scripture_references": A list of 3–5 Bible verses. Each item is an object with:
            - "reference" (e.g., "John 3:16")
            - "text" (exact verse text)
            - "context" (1–2 sentence explanation)
        - "tags": A list of 3–8 relevant tags, all lowercase and hyphenated

        Here's an example of the expected format:
        {{
            "title": "God's Unfailing Love",
            "summary": "This sermon highlights God's unconditional love...",
            "sermon_notes": ["Point 1", "Point 2"],
            "scripture_references": [
                {{
                    "reference": "Luke 15:20",
                    "text": "So he got up and went to his father...",
                    "context": "Illustrates the father's readiness to forgive."
                }}
            ],
            "tags": ["love", "forgiveness"]
        }}

        Now analyze this sermon transcription and return JSON in the same format:

        {transcription[:15000]}
        """

        try:
            response = self.client.chat.completions.create(
                model=settings.MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that analyzes Christian sermons. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Error analyzing sermon: {str(e)}")
            raise