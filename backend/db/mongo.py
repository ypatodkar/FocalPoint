import os
from pymongo import MongoClient

_client: MongoClient | None = None

def get_db():
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _client = MongoClient(uri)
    return _client[os.getenv("MONGODB_DB_NAME", "focalpoint")]
