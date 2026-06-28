import os
import google.generativeai as genai

_client = None

def _get_client():
    global _client
    if _client is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        _client = genai
    return _client

def generate_response(system_prompt: str, message: str, history: list[dict] = None) -> str:
    _get_client()
    model = genai.GenerativeModel(
        model_name=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
        system_instruction=system_prompt,
    )

    # Build multi-turn history for Gemini
    contents = []
    for msg in (history or []):
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [msg["content"]]})
    contents.append({"role": "user", "parts": [message]})

    response = model.generate_content(
        contents=contents,
        generation_config=genai.GenerationConfig(
            max_output_tokens=1024,
            temperature=0.7,
        )
    )
    return response.text.strip()
