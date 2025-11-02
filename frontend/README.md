# Frontend (Vite + React)

Quick start

1. Install dependencies

   npm install

2. Run dev server

   npm run dev

Environment

Set environment variables in a `.env` file (Vite uses `VITE_` prefix):

- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID
- `VITE_API_BASE` — backend base URL (default: http://localhost:8000)

Notes

- The Google Identity SDK is loaded in `index.html`. The Sidebar component triggers the Google One Tap / prompt and sends the ID token to `/api/auth/google` endpoint.
