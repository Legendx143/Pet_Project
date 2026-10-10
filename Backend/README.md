# Pet-Care Backend

Node.js / Express.js server that powers the Pet-Care health assessment platform.

## What it does

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Server health check |
| `/api/assess` | POST | Submit a pet health assessment (multipart form with text fields + optional files) |
| `/api/history` | GET | Fetch the authenticated user's assessment history |
| `/api/history/:id` | GET | Fetch a single assessment by ID |

### Assessment flow

1. **User submits** age, species, breed, symptom text/voice, optional image, and onset timestamp (text/voice)
2. **Backend validates** input and checks rate limits (max 3 assessments per minute per user)
3. **Files are uploaded** to Supabase Storage (`assessment-media` bucket)
4. **Voice notes are transcribed** using OpenAI Whisper (`gpt-4o-mini-transcribe`)
5. **AI analysis** via OpenAI GPT-4.1-mini returns structured JSON with:
   - Top 3 probable conditions with explanations
   - Triage level: **MONITOR**, **CONSULT**, or **URGENT**
   - For MONITOR: nutritional considerations and safe care steps
   - Warning signs to watch for
6. **Results are saved** to the `assessments` table in Supabase and returned to the frontend

### Authentication

All endpoints (except `/api/health`) require a valid Supabase JWT in the `Authorization: Bearer <token>` header. The backend verifies this token against Supabase Auth before processing.

## Setup

1. Run the SQL migrations in `../Database/supabase/migrations/` in order
2. Copy `.env.example` to `.env` and fill in your real values:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — the service role key (server-only, never expose)
   - `SUPABASE_PUBLISHABLE_KEY` — the publishable/anon key
   - `OPENAI_API_KEY` — your OpenAI API key
3. Install dependencies and start:

```bash
cd Backend
npm install
npm run dev
```

The server starts on `http://localhost:3001` by default.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key for admin access |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | Public anon key for JWT verification |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `OPENAI_MODEL` | ❌ | Analysis model (default: `gpt-4.1-mini`) |
| `OPENAI_TRANSCRIPTION_MODEL` | ❌ | Transcription model (default: `gpt-4o-mini-transcribe`) |
| `PORT` | ❌ | Server port (default: `3001`) |
| `FRONTEND_URL` | ❌ | CORS origin (default: `http://localhost:5173`) |
