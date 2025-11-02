Project: Image Caption Generator (React + Vite frontend, FastAPI backend)

Overview
--------
This repository contains a scaffold for an image caption generation web app.

Structure
---------
- `frontend/` — Vite + React + Tailwind CSS app. Uses @tanstack/react-query and Zustand. Client performs Google Sign-In via Google Identity Services, calls backend for caption generation and for saving/fetching history.
- `backend/` — FastAPI app exposing REST endpoints (`/api/generate`, `/api/auth/google`, `/api/history`). Includes a `model.py` placeholder that loads a model file from disk; replace with your model invocation.

Quick start (local dev)
-----------------------
1. Backend

   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp ../.env.example .env
   # set GOOGLE_CLIENT_ID, JWT_SECRET in .env
   uvicorn main:app --reload --host 0.0.0.0 --port 8000

2. Frontend

   cd frontend
   npm install
   npm run dev

Notes
-----
- The backend `model.py` is a placeholder — it returns a simple caption. Replace its logic with the code to call your model file.
- For production, deploy the frontend to Vercel (recommended) and the backend to a container host or serverless platform that supports FastAPI.
