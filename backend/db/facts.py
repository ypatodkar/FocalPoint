from datetime import datetime, timezone
from .mongo import get_db
from services.embeddings import embed, embed_query

# gemini-embedding-2 outputs 3072-dimensional vectors
EMBEDDING_DIM = 3072
INDEX_NAME    = "user_facts_vector_index"

def ensure_vector_index():
    db = get_db()
    existing = list(db.user_facts.list_search_indexes())
    names = [idx.get("name") for idx in existing]
    if INDEX_NAME not in names:
        db.user_facts.create_search_index({
            "name": INDEX_NAME,
            "type": "vectorSearch",
            "definition": {
                "fields": [
                    {
                        "type":         "vector",
                        "path":         "embedding",
                        "numDimensions": EMBEDDING_DIM,
                        "similarity":   "cosine",
                    },
                    {
                        "type": "filter",
                        "path": "user_id",
                    },
                ]
            },
        })
        print(f"[facts] Created vector search index '{INDEX_NAME}'")

def write_fact(user_id: str, fact: str, source: str = "meta_agent"):
    db     = get_db()
    vector = embed(fact)
    db.user_facts.insert_one({
        "user_id":    user_id,
        "fact":       fact,
        "embedding":  vector,
        "source":     source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

def get_relevant_facts(user_id: str, query: str, limit: int = 3) -> list[str]:
    db           = get_db()
    query_vector = embed_query(query)

    try:
        results = db.user_facts.aggregate([
            {
                "$vectorSearch": {
                    "index":       INDEX_NAME,
                    "path":        "embedding",
                    "queryVector": query_vector,
                    "numCandidates": limit * 10,
                    "limit":       limit,
                    "filter":      {"user_id": user_id},
                }
            },
            {"$project": {"fact": 1, "_id": 0}},
        ])
        return [r["fact"] for r in results]
    except Exception as e:
        print(f"[facts] Vector search failed ({e}), returning empty")
        return []
