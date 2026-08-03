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


class SpeakIn(BaseModel):
    text: str
    name: str = "Hannan"
    lang: str = "en-US"


@app.get("/health")
def health():
    return {"ok": True, "service": "orion-api", "version": "1.3"}


@app.post("/speak")
def speak(inp: SpeakIn):
    return {"reply": run(inp.text, inp.name)}
