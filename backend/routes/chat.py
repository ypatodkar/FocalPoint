import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from models import ChatRequest, ChatResponse, UserProfileOut
from db.users import get_user, update_user
from db.episodes import write_episode, get_recent_episodes
from db.sessions import increment_turn
from services.reward import compute_reward, update_profile_from_reward
from services.prompt_builder import build_system_prompt
import services.gemini as gemini_svc
import services.do_llm as do_svc

def _generate(system_prompt: str, message: str) -> str:
    try:
        return gemini_svc.generate_response(system_prompt, message)
    except Exception as e:
        print(f"[chat] Gemini failed ({e}), falling back to DigitalOcean")
        return do_svc.generate_response(system_prompt, message)

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    user    = get_user(req.user_id)
    reward  = None

    # Process gaze from previous response
    if req.previous_response_id and req.gaze_events:
        reward          = compute_reward(req.gaze_events)
        profile_updates = update_profile_from_reward(user, reward, req.gaze_events)

        if profile_updates:
            update_user(req.user_id, profile_updates)
            user.update(profile_updates)

        # Write episodic memory
        recent  = get_recent_episodes(req.user_id, limit=1)
        turn_no = (recent[0].get("turn", 0) + 1) if recent else 1

        write_episode({
            "user_id":        req.user_id,
            "session_id":     req.previous_response_id[:8],
            "turn":           turn_no,
            "response_id":    req.previous_response_id,
            "gaze_events":    [e.model_dump() for e in req.gaze_events],
            "reward":         reward,
            "profile_after":  {
                "complexity_score": user.get("complexity_score"),
                "preferred_format": user.get("preferred_format"),
            },
            "timestamp":      datetime.now(timezone.utc).isoformat(),
        })

    # Build adapted system prompt from current user profile
    system_prompt = build_system_prompt(user)

    text        = _generate(system_prompt, req.message)
    response_id = str(uuid.uuid4())

    return ChatResponse(
        response_id  = response_id,
        text         = text,
        reward       = reward,
        user_profile = UserProfileOut(
            complexity_score = user.get("complexity_score", 5),
            preferred_format = user.get("preferred_format", "prose"),
        ),
    )
