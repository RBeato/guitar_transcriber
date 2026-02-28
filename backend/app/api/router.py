from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.transcribe import router as transcribe_router
from app.api.transcribe_midi import router as transcribe_midi_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(transcribe_router)
api_router.include_router(transcribe_midi_router)
