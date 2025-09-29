# Christian video platform

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/niceiykes-projects/v0-christian-video-platform)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/dMYbFawAIpw)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/niceiykes-projects/v0-christian-video-platform](https://vercel.com/niceiykes-projects/v0-christian-video-platform)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/dMYbFawAIpw](https://v0.app/chat/projects/dMYbFawAIpw)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Local Development with FastAPI Backend

The app now uses a FastAPI backend (port 6000 by default) as the API layer in front of Supabase (DB/Auth).

### Backend

- Path: `../Backend/`
- Env: copy `Backend/.env.example` to `Backend/.env` and fill in:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWKS_URL`
  - `FRONTEND_ORIGIN` (e.g., `http://localhost:3000`)
  - `PORT=6000`

Run:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 6000 --reload
```

### Frontend

Create `.env.local` in this folder with:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:6000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then run the Next.js dev server as usual (npm/pnpm/yarn).

### Notes

- The frontend forwards the Supabase access token in `Authorization: Bearer <token>` for protected routes (favorites, AI update).
- Reads for videos and preachers are performed via FastAPI endpoints: `/api/data/videos` and `/api/data/preachers`.
