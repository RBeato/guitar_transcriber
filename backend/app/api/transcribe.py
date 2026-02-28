import logging
import time
import base64

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.transcription import TranscriptionService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    logger.info(
        "POST /api/transcribe — filename=%s content_type=%s",
        file.filename,
        file.content_type,
    )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    t0 = time.perf_counter()
    service = TranscriptionService()

    try:
        result = await service.transcribe(file)
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

    return {
        "tex": result["tex"],
        "gp5": base64.b64encode(result["gp5"]).decode(),
        "noteCount": result["note_count"],
    }
