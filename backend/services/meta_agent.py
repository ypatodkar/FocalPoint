import os
import json
import google.generativeai as genai
from db.users import update_user, add_prospective_flag
from db.episodes import get_session_episodes

# Antigravity = Google's hosted autonomous reasoning agent (Interactions API)
ANTIGRAVITY_MODEL = os.getenv("ANTIGRAVITY_MODEL", "antigravity-preview-05-2026")

META_PROMPT = """
You are an adaptive learning analyst embedded in FocalPoint, an AI that learns
how users read and continuously improves its responses.

You have the user's complete session: every turn, what the AI said, how the user
read it (gaze events per paragraph), and the reward score derived from that data.

Your task is deep pattern analysis — not surface-level observations.
Look for:
- Which response formats caused confusion vs smooth reading
- Which topics triggered repeated re-reading
- Whether complexity has been trending up or down
- What the user's reading stamina looks like (do they stop halfway?)

Session data:
{episodes}

Current user profile:
{profile}

Return a raw JSON object (no markdown fences):
{{
  "insights": [
    "3 specific, actionable insights about this user's reading behavior"
  ],
  "profile_updates": {{
    "complexity_score": <int 1-10>,
    "preferred_format": "<bullets|prose>",
    "avg_words_read": <int>,
    "reads_to_end": <bool>,
    "topics_to_simplify": ["<topic>"]
  }},
  "new_prospective_flags": [
    {{
      "topic": "<topic name>",
      "action": "<simplify|use_analogy|define_terms>"
    }}
  ]
}}
"""

def _call_antigravity(prompt: str) -> str:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model    = genai.GenerativeModel(model_name=ANTIGRAVITY_MODEL)
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.2,       # low temp — we want consistent JSON
            max_output_tokens=800,
        )
    )
    return response.text.strip()

def _parse_json(raw: str) -> dict:
    # Strip markdown fences if the model adds them
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

def run_meta_agent(user_id: str, session_id: str, current_profile: dict) -> list[str]:
    episodes = get_session_episodes(session_id)
    if not episodes:
        return []

    prompt = META_PROMPT.format(
        episodes=json.dumps(episodes, indent=2, default=str),
        profile=json.dumps(current_profile, indent=2, default=str),
    )

    try:
        raw = _call_antigravity(prompt)
        print(f"[meta_agent] Antigravity responded ({len(raw)} chars)")
    except Exception as e:
        raise RuntimeError(f"Antigravity meta-agent failed: {e}") from e

    try:
        result = _parse_json(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Meta-agent JSON parse failed: {e}; raw response: {raw[:200]}") from e

    # Apply profile updates to MongoDB
    if updates := result.get("profile_updates"):
        cleaned = {k: v for k, v in updates.items() if v is not None}
        if cleaned:
            update_user(user_id, cleaned)

    # Apply prospective flags
    for flag in result.get("new_prospective_flags", []):
        if flag.get("topic") and flag.get("action"):
            add_prospective_flag(user_id, flag)

    return result.get("insights", [])
