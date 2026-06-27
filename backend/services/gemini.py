import os
import google.generativeai as genai

_model = None

def _get_model():
    global _model
    if _model is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        _model = genai.GenerativeModel(
            model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        )
    return _model

def generate_response(system_prompt: str, message: str) -> str:
    model = _get_model()
    response = model.generate_content(
        contents=[
            {"role": "user", "parts": [system_prompt + "\n\n" + message]}
        ],
        generation_config=genai.GenerationConfig(
            max_output_tokens=600,
            temperature=0.7,
        )
    )
    return response.text.strip()
