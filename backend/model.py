import os
from io import BytesIO
from PIL import Image
from typing import Optional
import custom_model

# Paths to your trained model + vocab
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "caption_model_epoch_250.pth")
VOCAB_PATH = os.path.join(BASE_DIR, "vocab.pkl")

# Load once at startup
print("🔄 Loading image captioning model...")
try:
    model = custom_model.load_model(MODEL_PATH, VOCAB_PATH)
    print("✅ Loaded custom caption model successfully.")
except Exception as e:
    print("❌ Failed to load custom model:", e)
    model = None


def generate_caption(image_bytes: bytes, model_name: Optional[str] = None) -> str:
    """Generate caption using the real trained model."""
    if model is None:
        return "[error] Model not loaded"

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        caption = custom_model.generate(model, image)
        return caption
    except Exception as e:
        print("❌ Caption generation failed:", e)
        return f"[error] {str(e)}"


def list_models():
    return [{"id": "caption_model_epoch_250.pth", "type": "checkpoint"}]


def select_model(name: str) -> bool:
    return True
