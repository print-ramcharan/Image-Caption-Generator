# Backend (FastAPI)

Quick start

1. Create virtualenv and install deps

   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

2. Configure

   Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID` and `JWT_SECRET`.

3. Run

   uvicorn main:app --reload --host 0.0.0.0 --port 8000

Endpoints

- POST /api/auth/google — body { id_token } — exchange Google ID token for app JWT
- POST /api/generate — multipart file upload, returns { caption }
- GET /api/history — requires Authorization: Bearer <jwt>

Model

The `model.py` file contains a `generate_caption(image_bytes)` function you should replace with a call to your actual model implementation. If you have a model file, set the `MODEL_PATH` env var and load it there.
