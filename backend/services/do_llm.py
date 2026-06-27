import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../.env'))

_client: OpenAI | None = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        endpoint = os.getenv("DO_GENAI_ENDPOINT")
        api_key  = os.getenv("DO_GENAI_API_KEY")
        if not endpoint or not api_key:
            raise RuntimeError("DO_GENAI_ENDPOINT and DO_GENAI_API_KEY must be set")
        _client = OpenAI(base_url=endpoint, api_key=api_key)
    return _client

def generate_response(system_prompt: str, message: str) -> str:
    client = _get_client()
    model  = os.getenv("DO_GENAI_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": message},
        ],
        max_tokens=600,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()
