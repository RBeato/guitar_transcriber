import logging
import time
import base64

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.transcription import TranscriptionService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    target_fret: int | None = Form(default=None),
    onset_threshold: float | None = Form(default=None),
    frame_threshold: float | None = Form(default=None),
    minimum_note_length: float | None = Form(default=None),
    minimum_velocity: float | None = Form(default=None),
    merge_tolerance_ms: float | None = Form(default=None),
):
    logger.info(
        "POST /api/transcribe — filename=%s content_type=%s target_fret=%s",
        file.filename,
        file.content_type,
        target_fret,
    )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    t0 = time.perf_counter()
    service = TranscriptionService()

    # Collect non-None detection params
    detection_params = {}
    for key, val in [
        ("onset_threshold", onset_threshold),
        ("frame_threshold", frame_threshold),
        ("minimum_note_length", minimum_note_length),
        ("minimum_velocity", minimum_velocity),
        ("merge_tolerance_ms", merge_tolerance_ms),
    ]:
        if val is not None:
            detection_params[key] = val

    try:
        result = await service.transcribe(
            file,
            target_fret=target_fret,
            detection_params=detection_params or None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    elapsed = time.perf_counter() - t0
    logger.info(
        "Transcription complete — tex=%d chars, gp5=%d bytes in %.1fs",
        len(result["tex"]),
        len(result["gp5"]),
        elapsed,
    )

    # Build note summary for frontend debug log
    notes_summary = []
    for n in result.get("tab_notes", [])[:20]:
        notes_summary.append(f"s{n.string}f{n.fret}({n.midi_pitch})")

    return {
        "tex": result["tex"],
        "gp5": base64.b64encode(result["gp5"]).decode(),
        "noteCount": result["note_count"],
        "notesSummary": " ".join(notes_summary),
    }
