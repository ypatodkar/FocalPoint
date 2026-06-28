def build_system_prompt(profile: dict, message: str = "") -> str:
    score  = profile.get("complexity_score", 5)
    fmt    = profile.get("preferred_format", "prose")
    topics = profile.get("topics_to_simplify", [])
    flags  = profile.get("prospective_flags", [])
    reads_to_end = profile.get("reads_to_end", True)
    avg_words    = profile.get("avg_words_read", 200)

    parts = [
        "You are a helpful, knowledgeable AI assistant.",
        "You adapt your communication style based on how the user reads your responses.",
        "Be direct and complete — answer what was asked fully.",
        "Always write in short, distinct paragraphs separated by blank lines. Never write walls of text.",
    ]

    # Format
    if fmt == "bullets":
        parts.append("Structure your responses with bullet points or numbered lists when presenting multiple ideas.")
    else:
        parts.append("Use clear, natural prose with paragraph breaks between each idea.")

    # Complexity / vocabulary
    if score <= 3:
        parts.append("Use very simple language and short sentences. Avoid jargon entirely. Explain every term you use.")
    elif score <= 5:
        parts.append("Use plain, accessible language. Avoid jargon unless necessary — define it when you use it.")
    elif score <= 7:
        parts.append("You can use moderate technical language. Assume a curious, intelligent non-expert reader.")
    else:
        parts.append("Feel free to use technical depth and nuance. The user is comfortable with advanced concepts.")

    # Length calibrated to how much this user actually reads
    if not reads_to_end:
        parts.append(f"IMPORTANT: Keep your response under {avg_words} words. This user stops reading before long responses end — front-load the key information.")
    else:
        parts.append(f"Keep responses under {avg_words + 50} words unless the question genuinely requires more depth.")

    # Topic-specific simplification from gaze data
    if topics:
        joined = ", ".join(topics)
        parts.append(f"When discussing {joined}: use extra-simple explanations and concrete real-world analogies.")

    # Prospective flags from meta-agent
    for flag in flags:
        action = flag.get("action")
        topic  = flag.get("topic")
        if not topic:
            continue
        if action == "use_analogy":
            parts.append(f"For {topic}: lead with a real-world analogy before any technical explanation.")
        elif action == "simplify":
            parts.append(f"For {topic}: use the simplest possible language, short sentences, no jargon.")
        elif action == "define_terms":
            parts.append(f"For {topic}: define every technical term before using it.")

    # CoALA semantic memory: vector-retrieve facts relevant to this specific message
    if message:
        try:
            from db.facts import get_relevant_facts
            user_id = profile.get("_id", "")
            if user_id:
                facts = get_relevant_facts(user_id, message, limit=3)
                if facts:
                    facts_block = "\n".join(f"- {f}" for f in facts)
                    parts.append(
                        f"Insights from how this user has read your past responses:\n{facts_block}\n"
                        "Use these to fine-tune your tone, depth, and format for this reply."
                    )
        except Exception as e:
            print(f"[prompt_builder] Semantic fact retrieval failed ({e})")

    return "\n\n".join(parts)
