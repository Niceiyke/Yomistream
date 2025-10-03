Transcription service configuration

The backend no longer performs local transcription using Whisper. Instead, it sends audio files to a configured remote transcription API.

Environment variables

- TRANSCRIBE_API_URL (required) — URL of the transcription endpoint. The app will POST multipart/form-data with the audio file under `file` and include `language`.
- TRANSCRIBE_API_KEY (optional) — Bearer token to include as Authorization header when calling the remote API.

Expected transcription response

The transcription service should return JSON with at least the following shape:

{
  "text": "The transcribed text...",
  ...optional fields...
}

Compatibility

Existing endpoints keep the same behavior: they expect the Transcriber client to return a dict with a `text` field. If you run a managed transcription provider, ensure the above contract is satisfied.

Why this change

Removing Whisper and related ML dependencies (torch, transformers, etc.) drastically reduces the image size and avoids heavy model downloads during Docker builds. If you later want to re-enable local transcription, reintroduce the old `whisper` implementation and the required packages.
