import os
import google.generativeai as genai

def _configure():
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def embed(text: str) -> list[float]:
    _configure()
    result = genai.embed_content(
        model="models/gemini-embedding-2",
        content=text,
        task_type="RETRIEVAL_DOCUMENT",
    )
    return result["embedding"]

def embed_query(text: str) -> list[float]:
    _configure()
    result = genai.embed_content(
        model="models/gemini-embedding-2",
        content=text,
        task_type="RETRIEVAL_QUERY",
    )
    return result["embedding"]
