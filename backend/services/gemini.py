import os
import google.generativeai as genai

_client = None

def _get_client():
    global _client
    if _client is None:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        _client = genai
    return _client

def generate_response(system_prompt: str, message: str, history: list[dict] = None, max_tokens: int = 1024) -> str:
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
            max_output_tokens=max_tokens,
            temperature=0.7,
        )
    )
    return response.text.strip()

def generate_follow_up_questions(user_message: str, assistant_response: str) -> list[str]:
    _get_client()
    model = genai.GenerativeModel(model_name=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"))
    prompt = (
        f"The user asked: \"{user_message}\"\n"
        f"The assistant replied:\n{assistant_response[:800]}\n\n"
        "Generate exactly 3 short follow-up questions the user might want to ask next. "
        "Each question on its own line. No numbering, no bullets, no extra text."
    )
    try:
        resp = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(max_output_tokens=300, temperature=0.7),
        )
        lines = [l.strip().lstrip('-•*0123456789. ') for l in resp.text.strip().splitlines() if l.strip()]
        return lines[:3]
    except Exception:
        return []
