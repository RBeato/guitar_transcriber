import logging
import time
import base64

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.note_event import NoteEvent
from app.services.transcription import TranscriptionService

logger = logging.getLogger(__name__)

router = APIRouter()


class MidiNoteInput(BaseModel):
    start_time: float
    end_time: float
    midi_pitch: int
    velocity: float


class MidiTranscribeRequest(BaseModel):
    notes: list[MidiNoteInput]
    target_fret: int | None = None


@router.post("/transcribe-midi")
async def transcribe_midi(request: MidiTranscribeRequest):
    logger.info(
        "POST /api/transcribe-midi — %d notes, target_fret=%s",
        len(request.notes),
        request.target_fret,
    )

    if not request.notes:
        raise HTTPException(status_code=400, detail="No notes provided")

    # Convert to internal NoteEvent format
    note_events = [
        NoteEvent(
            start_time=n.start_time,
            end_time=n.end_time,
            midi_pitch=n.midi_pitch,
            velocity=n.velocity,
        )
        for n in request.notes
    ]

    t0 = time.perf_counter()
    service = TranscriptionService()

    try:
        result = service.transcribe_from_notes(
            note_events,
            target_fret=request.target_fret,
        )
    except Exception as e:
        logger.exception("MIDI transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    elapsed = time.perf_counter() - t0
    logger.info("MIDI transcription complete in %.1fs", elapsed)

    notes_summary = []
    for n in result.get("tab_notes", [])[:20]:
        notes_summary.append(f"s{n.string}f{n.fret}({n.midi_pitch})")

    return {
        "tex": result["tex"],
        "gp5": base64.b64encode(result["gp5"]).decode(),
        "noteCount": result["note_count"],
        "notesSummary": " ".join(notes_summary),
    }
