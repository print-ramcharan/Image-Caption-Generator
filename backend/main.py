import os
import json
import logging
from typing import Optional
from model import generate_caption, list_models, select_model

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Response, Cookie, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# local modules
from auth import verify_google_id_token, create_jwt, verify_jwt

load_dotenv()

# logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DB_PATH = os.environ.get('HISTORY_DB', './history_db.json')

app = FastAPI(title="Image Caption Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def load_db():
    try:
        with open(DB_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        logger.debug("Failed to load DB - returning empty")
        return {}


def save_db(db):
    try:
        with open(DB_PATH, 'w') as f:
            json.dump(db, f)
        logger.debug("DB saved successfully")
    except Exception:
        logger.exception("Failed to save DB")


class TokenIn(BaseModel):
    token: str  # Google ID token from frontend


@app.post('/api/auth/google')
async def auth_google(payload: TokenIn, response: Response, anon_id: Optional[str] = Cookie(None)):
    """Verify Google ID token and return a JWT."""
    logger.info("/api/auth/google called")
    try:
        info = verify_google_id_token(payload.token)
    except Exception:
        logger.exception("verify_google_id_token failed")
        raise HTTPException(status_code=401, detail='Invalid Google token')

    if not info:
        raise HTTPException(status_code=401, detail='Invalid Google token')

    try:
        token = create_jwt(info['sub'], info.get('email', ''))
    except Exception:
        logger.exception("create_jwt failed")
        raise HTTPException(status_code=500, detail='Failed to create authentication token')

    # Merge anon history if present
    if anon_id:
        db = load_db()
        anon_key = f'anon:{anon_id}'
        anon_hist = db.get(anon_key)
        if anon_hist:
            user_hist = db.get(info['sub'], [])
            items = anon_hist.get('items', [])
            for it in reversed(items):
                user_hist.insert(0, it)
            db[info['sub']] = user_hist[:100]
            try:
                del db[anon_key]
            except KeyError:
                pass
            save_db(db)
        response.delete_cookie('anon_id')

    return {'token': token, 'user': {'sub': info['sub'], 'email': info.get('email')}}


@app.post('/api/generate')
async def generate(response: Response,
                   file: UploadFile = File(...),
                   model: Optional[str] = Form(None),
                   authorization: Optional[str] = Header(None),
                   anon_id: Optional[str] = Cookie(None)):
    logger.info(f"/api/generate called - file: {getattr(file, 'filename', None)}, model: {model}")

    data = await file.read()

    try:
        caption = generate_caption(data, model_name=model)
    except Exception as e:
        logger.exception("Caption generation failed")
        raise HTTPException(status_code=500, detail=f'Caption generation failed: {str(e)}')

    # Authenticated user: save to their history
    if authorization and authorization.startswith('Bearer '):
        payload = verify_jwt(authorization.split(' ', 1)[1])
        if payload:
            user = payload.get('sub')
            db = load_db()
            user_hist = db.get(user, [])
            import time as _time
            user_hist.insert(0, {'caption': caption, 'timestamp': _time.time()})
            db[user] = user_hist[:100]
            save_db(db)
            return {'caption': caption}

    # Anonymous flow: one free generation tracked by cookie
    import uuid
    import time as _time
    db = load_db()
    if not anon_id:
        anon_id = str(uuid.uuid4())
        response.set_cookie(key='anon_id', value=anon_id, httponly=True, max_age=30 * 24 * 3600)

    anon_key = f'anon:{anon_id}'
    anon_hist = db.get(anon_key, {'count': 0, 'items': []})
    if anon_hist.get('count', 0) >= 1:
        raise HTTPException(status_code=403, detail='Free generation used — please sign in to continue')

    anon_hist['items'].insert(0, {'caption': caption, 'timestamp': _time.time()})
    anon_hist['count'] = anon_hist.get('count', 0) + 1
    db[anon_key] = anon_hist
    save_db(db)

    return {'caption': caption}


@app.get('/api/models')
async def api_list_models():
    # kept for compatibility - model.py provides list_models() (returns empty or single model)
    try:
        models = list_models()
        return {'models': models}
    except Exception:
        return {'models': []}


class SelectIn(BaseModel):
    model: str


@app.post('/api/models/select')
async def api_select_model(payload: SelectIn):
    ok = select_model(payload.model)
    if not ok:
        raise HTTPException(status_code=404, detail='Model not found')
    return {'ok': True, 'selected': payload.model}


@app.get('/api/history')
async def get_history(authorization: Optional[str] = Header(None), anon_id: Optional[str] = Cookie(None)):
    db = load_db()
    if authorization and authorization.startswith('Bearer '):
        payload = verify_jwt(authorization.split(' ', 1)[1])
        if not payload:
            raise HTTPException(status_code=401, detail='Invalid token')
        user = payload.get('sub')
        history = db.get(user, [])
        return {'history': history}

    if anon_id:
        anon_key = f'anon:{anon_id}'
        anon_hist = db.get(anon_key, {'items': []})
        return {'history': anon_hist.get('items', [])}

    raise HTTPException(status_code=401, detail='Missing token or anon cookie')


@app.post('/api/history')
async def post_history(item: dict, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    payload = verify_jwt(authorization.split(' ', 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = payload.get('sub')
    db = load_db()
    user_hist = db.get(user, [])
    user_hist.insert(0, item)
    db[user] = user_hist[:100]
    save_db(db)
    return {'ok': True}


@app.post('/api/generate_url')
async def generate_url(payload: dict, authorization: Optional[str] = Header(None), anon_id: Optional[str] = Cookie(None)):
    """Generate caption from an externally hosted image URL (JSON body: { image_url, model }).
    The backend will download the image and run the same generation flow as /api/generate.
    """
    image_url = payload.get('image_url') if isinstance(payload, dict) else None
    model = payload.get('model') if isinstance(payload, dict) else None
    logger.info(f"/api/generate_url called - url: {image_url}, model: {model}")

    if not image_url:
        raise HTTPException(status_code=400, detail='Missing image_url')

    # download the image bytes
    try:
        from urllib.request import urlopen
        with urlopen(image_url) as resp:
            data = resp.read()
    except Exception as e:
        logger.exception('Failed to download image URL')
        raise HTTPException(status_code=400, detail=f'Failed to download image: {str(e)}')

    try:
        caption = generate_caption(data, model_name=model)
    except Exception as e:
        logger.exception("Caption generation failed")
        raise HTTPException(status_code=500, detail=f'Caption generation failed: {str(e)}')

    # Authenticated user: save to their history (include image info if provided)
    image_path = payload.get('image_path') if isinstance(payload, dict) else None
    if authorization and authorization.startswith('Bearer '):
        payload_jwt = verify_jwt(authorization.split(' ', 1)[1])
        if payload_jwt:
            user = payload_jwt.get('sub')
            db = load_db()
            user_hist = db.get(user, [])
            import time as _time
            entry = {'caption': caption, 'timestamp': _time.time()}
            if image_url:
                entry['imageUrl'] = image_url
            if image_path:
                entry['imagePath'] = image_path
            if model:
                entry['model'] = model
            user_hist.insert(0, entry)
            db[user] = user_hist[:100]
            save_db(db)
            return {'caption': caption}

    # Anonymous flow: same one-free-generation policy
    import uuid
    import time as _time
    db = load_db()
    if not anon_id:
        anon_id = str(uuid.uuid4())
        # Note: we can't set cookie on a JSON-only endpoint easily; client should manage anon flow
    anon_key = f'anon:{anon_id}'
    anon_hist = db.get(anon_key, {'count': 0, 'items': []})
    if anon_hist.get('count', 0) >= 1:
        raise HTTPException(status_code=403, detail='Free generation used — please sign in to continue')

    anon_entry = {'caption': caption, 'timestamp': _time.time()}
    if image_url:
        anon_entry['imageUrl'] = image_url
    if payload.get('image_path'):
        anon_entry['imagePath'] = payload.get('image_path')
    if model:
        anon_entry['model'] = model
    anon_hist['items'].insert(0, anon_entry)
    anon_hist['count'] = anon_hist.get('count', 0) + 1
    db[anon_key] = anon_hist
    save_db(db)

    return {'caption': caption}


@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up")
    logger.info(f"GOOGLE_CLIENT_ID: {os.environ.get('GOOGLE_CLIENT_ID', 'NOT SET')}")
