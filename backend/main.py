import json
import os
import pathlib
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from brain import run

app = FastAPI(title="Orion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MEM_FILE = pathlib.Path(__file__).parent / "memories.json"


def db():
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        return None
    from pymongo import MongoClient

    return MongoClient(uri, serverSelectionTimeoutMS=3000)["orion"]


def _local_load():
    try:
        return json.loads(MEM_FILE.read_text(encoding="utf-8")) if MEM_FILE.exists() else []
    except Exception:
        return []


def _local_save(list):
    try:
        MEM_FILE.write_text(json.dumps(list, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def get_memories():
    try:
        client = db()
        if client:
            docs = list(
                client.memories.find({}, {"_id": 0, "text": 1, "at": 1}).sort("at", -1).limit(200)
            )
            return [{"text": d.get("text", ""), "at": str(d.get("at", ""))} for d in docs]
    except Exception:
        pass
    return _local_load()


def add_memory(text):
    entry = {"text": text, "at": datetime.now(timezone.utc).isoformat()}
    try:
        client = db()
        if client:
            client.memories.insert_one(entry)
            return
    except Exception:
        pass
    _local_save([entry] + _local_load())


class SpeakIn(BaseModel):
    text: str
    name: str = "Hannan"
    lang: str = "en-US"


class MemoryIn(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True, "service": "orion-api", "version": "1.4", "db": "mongodb" if db() else "local"}


@app.post("/speak")
def speak(inp: SpeakIn):
    return {"reply": run(inp.text, inp.name)}


@app.get("/memory")
def memory_list():
    return {"memories": get_memories()}


@app.post("/memory")
def memory_add(inp: MemoryIn):
    if not inp.text.strip():
        return {"ok": False}
    add_memory(inp.text.strip())
    return {"ok": True}
