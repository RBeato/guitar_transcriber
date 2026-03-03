import logging
import time
import base64
import tempfile

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import pretty_midi

from app.models.note_event import NoteEvent
from app.models.guitar import GUITAR_MIN_MIDI, GUITAR_MAX_MIDI
from app.services.transcription import TranscriptionService

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {"mid", "midi"}


@router.post("/transcribe-midi-file")
async def transcribe_midi_file(
    file: UploadFile = File(...),
    target_fret: int | None = Form(default=None),
    tuning: str | None = Form(default=None),
):
    logger.info(
        "POST /api/transcribe-midi-file — filename=%s target_fret=%s",
        file.filename,
        target_fret,
    )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Expected .mid or .midi",
        )

    # Save to temp file for pretty_midi to parse
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="MIDI file too large (max 10 MB)")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=True) as tmp:
        tmp.write(content)
        tmp.flush()

        try:
            midi = pretty_midi.PrettyMIDI(tmp.name)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse MIDI file: {e}")

    # Extract notes from all instruments
    note_events: list[NoteEvent] = []
    for instrument in midi.instruments:
        if instrument.is_drum:
            continue
        for note in instrument.notes:
            if note.pitch < GUITAR_MIN_MIDI or note.pitch > GUITAR_MAX_MIDI:
                continue
            velocity = max(0.0, min(1.0, note.velocity / 127.0))
            note_events.append(
                NoteEvent(
                    start_time=note.start,
                    end_time=note.end,
                    midi_pitch=note.pitch,
                    velocity=velocity,
                )
            )

    if not note_events:
        raise HTTPException(
            status_code=400,
            detail="No guitar-range notes found in MIDI file (range: MIDI 40-88)",
        )

    note_events.sort(key=lambda n: (n.start_time, n.midi_pitch))
    logger.info("Extracted %d guitar-range notes from MIDI file", len(note_events))

    t0 = time.perf_counter()
    service = TranscriptionService()

    try:
        result = service.transcribe_from_notes(
            note_events,
            target_fret=target_fret,
            tuning_name=tuning,
        )
    except Exception as e:
        logger.exception("MIDI file transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    elapsed = time.perf_counter() - t0
    logger.info("MIDI file transcription complete in %.1fs", elapsed)

    notes_summary = []
    for n in result.get("tab_notes", [])[:20]:
        notes_summary.append(f"s{n.string}f{n.fret}({n.midi_pitch})")

    return {
        "tex": result["tex"],
        "gp5": base64.b64encode(result["gp5"]).decode(),
        "midi": base64.b64encode(result["midi"]).decode(),
        "musicxml": base64.b64encode(result["musicxml"]).decode(),
        "noteCount": result["note_count"],
        "notesSummary": " ".join(notes_summary),
    }
