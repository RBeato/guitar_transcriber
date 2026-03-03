import logging
import base64

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.note_event import NoteEvent, TabNote
from app.services.transcription import TranscriptionService
from app.services.musicxml_builder import MusicXMLBuilder
from app.services.midi_builder import MidiBuilder
from app.services.guitarpro_builder import GuitarProBuilder
from app.services.alphatex_builder import AlphaTexBuilder
from app.models.guitar import get_tuning
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ExportNoteInput(BaseModel):
    start_time: float
    end_time: float
    midi_pitch: int
    velocity: float
    string: int
    fret: int


class ExportRequest(BaseModel):
    notes: list[ExportNoteInput]
    format: str  # "musicxml", "midi", "gp5"
    tempo: int = settings.tempo_bpm
    tuning: str | None = None


@router.post("/export")
async def export_tab(request: ExportRequest):
    logger.info("POST /api/export — format=%s, %d notes, tempo=%d",
                request.format, len(request.notes), request.tempo)

    if not request.notes:
        raise HTTPException(status_code=400, detail="No notes provided")

    fmt = request.format.lower()
    if fmt not in ("musicxml", "midi", "gp5"):
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Use musicxml, midi, or gp5")

    tuning = get_tuning(request.tuning)
    tab_notes = [
        TabNote(
            start_time=n.start_time,
            end_time=n.end_time,
            midi_pitch=n.midi_pitch,
            velocity=n.velocity,
            string=n.string,
            fret=n.fret,
        )
        for n in request.notes
    ]

    if fmt == "musicxml":
        builder = MusicXMLBuilder(tempo=request.tempo)
        data = builder.build(tab_notes, tuning)
        return {
            "data": base64.b64encode(data).decode(),
            "filename": "transcription.musicxml",
            "contentType": "application/vnd.recordare.musicxml+xml",
        }
    elif fmt == "midi":
        builder = MidiBuilder(tempo=request.tempo)
        data = builder.build(tab_notes)
        return {
            "data": base64.b64encode(data).decode(),
            "filename": "transcription.mid",
            "contentType": "audio/midi",
        }
    else:  # gp5
        builder = GuitarProBuilder(tempo=request.tempo)
        data = builder.build_with_tuning(tab_notes, tuning)
        return {
            "data": base64.b64encode(data).decode(),
            "filename": "transcription.gp5",
            "contentType": "application/octet-stream",
        }
