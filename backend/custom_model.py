import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

# Globals
model = None
processor = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_model(model_path=None, vocab_path=None):
    """Load BLIP model once."""
    global model, processor
    try:
        print("🔄 Loading BLIP image captioning model...")
        processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(device)
        model.eval()
        print("✅ BLIP model loaded successfully.")
        return model  # Return reference (for model.py)
    except Exception as e:
        print(f"❌ Failed to load BLIP model: {e}")
        return None


def generate(model_ref, image: Image.Image) -> str:
    """Generate a caption for a PIL image."""
    global model, processor

    # Use global model if not explicitly provided
    if model_ref is None:
        model_ref = model

    if model_ref is None or processor is None:
        return "[error] Model not loaded"

    try:
        inputs = processor(image, return_tensors="pt").to(device)
        with torch.no_grad():
            output = model_ref.generate(**inputs, max_new_tokens=30)
        caption = processor.decode(output[0], skip_special_tokens=True)
        return caption
    except Exception as e:
        return f"[error] {e}"
