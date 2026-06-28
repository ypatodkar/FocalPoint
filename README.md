# FocalPoint

FocalPoint is a gaze-aware LLM chat interface. The frontend tracks which response zones a user reads, skips, or revisits, sends those gaze events to a FastAPI backend, and the backend updates the next Gemini system prompt from MongoDB-backed user/session memory.

## Current Architecture

- Frontend: React + Vite on `http://localhost:5173`
- Backend: FastAPI on `http://127.0.0.1:8000`
- LLM: Gemini through `google-generativeai`
- Database: MongoDB Atlas via `pymongo`
- Eye tracking: WebGazer in the browser

The app intentionally has no mock or fallback response path. If Gemini, MongoDB, CORS, or the backend is broken, the UI shows the real backend error.

## What Changed

- Root `npm run dev` now starts both the backend and frontend.
- Vite uses strict port `5173`, matching the backend CORS configuration.
- Frontend chat calls now require the FastAPI backend; local simulation was removed.
- Backend chat now fails with a real `502` when Gemini generation fails.
- DigitalOcean/OpenAI fallback code was removed.
- `MONGODB_URI` is required; the backend no longer silently defaults to local MongoDB.
- Sessions and profile state now persist through backend endpoints and MongoDB, not browser localStorage.
- Added backend endpoints:
  - `GET /profile`
  - `POST /profile`
  - `GET /sessions`
  - `POST /sessions`
  - `DELETE /sessions/{session_id}`
- Gaze zones are scoped by response id so previous assistant messages do not pollute the next reward calculation.

## Requirements

- Node.js and npm
- Python 3
- MongoDB Atlas connection string
- Gemini API key

## Environment

Create `.env` in the repo root:

```bash
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
MONGODB_URI=your_mongodb_atlas_uri
MONGODB_DB_NAME=focalpoint
```

`GEMINI_MODEL` is optional in code, but setting it explicitly is clearer for demos.

## Install

Install root dev tooling:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Install backend dependencies:

```bash
python3 -m pip install -r backend/requirements.txt
```

## Run

From the repo root:

```bash
npm run dev
```

This starts both services:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`

Do not run only `cd frontend && npm run dev` for normal use. The UI needs the FastAPI backend for chat, profile updates, session history, and MongoDB writes.

## Verify

Check backend health:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

Check the demo profile:

```bash
curl 'http://127.0.0.1:8000/profile?user_id=demo_user'
```

Run production build:

```bash
npm run build
```

Run frontend lint:

```bash
cd frontend
npm run lint
```

## API Contract

### `POST /chat`

Request:

```json
{
  "user_id": "demo_user",
  "message": "explain recursion",
  "session_id": "s_123",
  "history": [],
  "previous_response_id": null,
  "gaze_events": []
}
```

Response:

```json
{
  "response_id": "uuid",
  "text": "LLM response",
  "reward": null,
  "user_profile": {
    "complexity_score": 5,
    "preferred_format": "prose"
  },
  "system_prompt": "current adapted prompt"
}
```

On model failure, `/chat` returns a non-2xx error. It does not return simulated text.

## Notes

- `demo_user` is hardcoded for the hackathon demo.
- WebGazer calibration data may still use browser localStorage; chat/session/profile state does not.
- If port `5173` is already in use, `npm run dev` fails instead of moving the frontend to a different port.
