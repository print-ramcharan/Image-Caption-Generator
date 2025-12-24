Project: Image Caption Generator (React + Vite frontend, FastAPI backend)

Overview
--------
Web app that authenticates with Google, uploads an image, and returns a generated caption from the FastAPI backend.

Prerequisites
-------------
- Python 3.10+
- Node.js 18+ (npm included)
- Git

Clone the repo
--------------
```bash
git clone https://github.com/print-ramcharan/Image-Caption-Generator.git
cd Image-Caption-Generator
```

Backend setup (FastAPI)
-----------------------
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# create .env with required secrets
cat > .env <<'EOF'
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=replace_me
# optional: MODEL_PATH=/absolute/path/to/model
EOF

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend setup (Vite + React)
-----------------------------
```bash
cd frontend
npm install

# create .env with Vite-prefixed vars
cat > .env <<'EOF'
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_API_BASE=http://localhost:8000
EOF

npm run dev
# app runs at http://localhost:5173
```

Project structure
-----------------
- `frontend/` — Vite + React + Tailwind, uses @tanstack/react-query and Zustand. Handles Google Sign-In and calls backend for caption generation and history.
- `backend/` — FastAPI service exposing `/api/generate`, `/api/auth/google`, `/api/history`. `model.py` contains `generate_caption(image_bytes)`; replace with your model invocation and load from `MODEL_PATH` if needed.

Docker (optional)
-----------------
If you prefer containers, add the required env vars to a `.env` file in the repo root, then run:
```bash
docker-compose up --build
```

Notes
-----
- The provided `model.py` returns a placeholder caption; wire it to your model for real predictions.
- Sample reference/prediction JSON files live in `backend/` for evaluation helpers.
