<!--
Brief, actionable instructions for AI coding agents working in the YomiStream repo.
Focus: Backend (FastAPI) + Frontend (Next.js) integration points, runtime, and project conventions.
-->

# Copilot / AI Agent Instructions — YomiStream

Summary
- This repo contains a Next.js frontend (`Frontend/`) and a FastAPI Python backend (`Backend/`). The backend is the canonical API layer in front of Supabase (DB + Auth).
- Primary backend entry: `Backend/app/main.py` (uvicorn). Configuration lives in `Backend/app/config.py` (uses pydantic-settings + .env).

Essential architecture (big picture)
- Frontend (Next.js) calls the FastAPI backend at `http://<API_BASE>/api/*`. The default backend port is 6000 (see `config.py`).
- Backend responsibilities: download/trim audio (`app/services/downloader.py`), transcribe (`app/services/transcribe.py` using Whisper), analyze content (`app/services/analyze.py`), and save/serve downloadable audio and transcripts.
- Auth: Supabase JWT verification is implemented in `app/auth.py` (JWKS RS256 primary, HS256 fallback using `SUPABASE_JWT_SECRET`).
- Supabase client factory: `app/supabase_client.py` (use `get_supabase()` to get a cached client).

How to run locally (developer workflow)
- Backend: from the repo root run (or from `Backend/`):
  - `uvicorn app.main:app --host 0.0.0.0 --port 6000 --reload`
  - Environment variables: copy `Backend/.env.example` -> `Backend/.env` and fill `SUPABASE_*`, `OPENAI_API_KEY`, `FRONTEND_ORIGIN`, etc. `config.py` uses `.env` and environment variables.
- Frontend: see `Frontend/README.md` (Next.js). The frontend expects `NEXT_PUBLIC_API_BASE_URL` to point to the running backend (e.g., `http://localhost:6000`).

Key files and patterns to reference when editing code
- `Backend/app/main.py` — where routers are mounted; prefer adding new endpoints under `app/api/` and register in `main.py`.
- `Backend/app/api/endpoints.py` — example of request validation via Pydantic models in `app/models/schemas.py` and heavy-lift logic delegated to `app/services/*`.
- `Backend/app/services/` — each service (downloader, transcribe, analyze, sermon_processor) owns a single responsibility. Follow that separation: endpoints should be thin and call service functions.
- `Backend/app/utils/files.py` — file helpers (safe filename, saving uploads) — reuse these utilities for consistent behavior.

Conventions & project-specific behaviors
- Long-running operations (download → transcribe → analyze) are synchronous in code but often use temporary directories; ensure cleanup in finally blocks (see `sermon_processor.py`).
- Temporary artifacts: services create temporary dirs and remove them. When adding features that save persistent files, use `downloads/` and ensure `ensure_unique_path()` is used.
- Transcription: `app/services/transcribe.py` uses Whisper and loads model based on `WHISPER_MODEL` in `config.py`. Model loading happens once per process (singleton pattern). Heavy models require GPU if you modify to use fp16 — do not assume GPU in CI.
- Authentication: `app/auth.py` expects Authorization bearer tokens; prefer the `get_current_user` dependency for protected endpoints.

Integration and external dependencies
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_SECRET` (fallback). Use `get_supabase()`.
- Whisper (python package `whisper`) and `yt-dlp` are used for transcription and downloads; ffmpeg must be available in the environment (Dockerfile installs it).
- OpenAI / Groq / other keys: used by `app/services/analyze.py` and related code; set via env variables.

Testing, CI and deployment notes
- There are no unit tests currently committed. Add tests under `Backend/tests/` and run them in CI prior to building images.
- Docker: backend Dockerfile is at `Backend/Dockerfile`. It installs `ffmpeg` and dependencies and runs `uvicorn app.main:app`. When editing the Dockerfile keep port consistent with `config.py` (8001 by default).
- GitHub Actions: a workflow exists at `.github/workflows/docker-publish.yml` to build and push the backend image to Docker Hub. The workflow uses secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

Quick editing tips and examples
- Adding an API route:
  1. Add/extend a router in `Backend/app/api/` (follow existing pattern in `endpoints.py`).
  2. Add Pydantic models in `Backend/app/models/schemas.py` for request/response types.
  3. Delegate work to a function in `Backend/app/services/` — services manage files and cleanup.
  4. Register the router in `Backend/app/main.py` if adding a new router file.

When making backward-incompatible changes
- If you change API routes or response shapes, update `Frontend/` components that call those endpoints (search for `/api/data/` or `/api/` usages in `Frontend/`), and update any docs in `Frontend/README.md`.

Where to look first when debugging
- Request routing and CORS: `Backend/app/main.py` (CORS allow origins controlled by `FRONTEND_ORIGIN`).
- Download problems: `Backend/app/services/downloader.py` (see `yt_dlp` options & trimming strategies).
- Transcription issues: `Backend/app/services/transcribe.py` (model loading and whisper args).
- Auth problems: `Backend/app/auth.py` (JWKS retrieval, HS256 fallback).

When you need more information
- Ask the repo owner to share `Backend/.env` values (safely) or a `.env.example` if present; many runtime behaviors depend on those secrets.

If this file should merge with an existing `.github/copilot-instructions.md`, preserve custom sections about team norms and terminal workflows. Otherwise, use this as the authoritative guidance for new AI agents.

---
Please review these instructions and tell me if there are other workflows (tests, build scripts, or deploy details) you want included or if you prefer different phrasing for any section.
