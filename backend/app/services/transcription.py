import os
import logging
import time

from fastapi import UploadFile

from app.services.audio_processor import AudioProcessor
from app.services.pitch_detector import PitchDetector
from app.services.tab_solver import TabSolver
from app.services.guitarpro_builder import GuitarProBuilder
from app.services.alphatex_builder import AlphaTexBuilder

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Orchestrates the full transcription pipeline:
    audio file -> pitch detection -> string/fret solving -> GP5 + alphaTex output.
    """

    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.pitch_detector = PitchDetector()
        self.tab_solver = TabSolver()
        self.gp_builder = GuitarProBuilder()
        self.tex_builder = AlphaTexBuilder()

    async def transcribe(self, file: UploadFile) -> dict:
        # 1. Validate and save uploaded audio
        logger.info("[1/4] Saving uploaded file...")
        audio_path = await self.audio_processor.save_upload(file)
        file_size = audio_path.stat().st_size
        logger.info("[1/4] Saved %s (%d bytes)", audio_path.name, file_size)

        try:
            # 2. Detect notes with Basic Pitch
            logger.info("[2/4] Running pitch detection...")
            t0 = time.perf_counter()
            notes = self.pitch_detector.detect(audio_path)
            t1 = time.perf_counter()
            logger.info(
                "[2/4] Detected %d notes in %.1fs (pitches: %s)",
                len(notes),
                t1 - t0,
                ", ".join(str(n.midi_pitch) for n in notes[:10])
                + ("..." if len(notes) > 10 else ""),
            )

            if not notes:
                logger.warning("[2/4] No notes detected — returning empty tab")
                return {
                    "tex": self.tex_builder.build([]),
                    "gp5": self.gp_builder.build([]),
                    "note_count": 0,
                }

            # 3. Solve string/fret assignments
            logger.info("[3/4] Solving string/fret assignments...")
            t0 = time.perf_counter()
            tab_notes = self.tab_solver.solve(notes)
            t1 = time.perf_counter()
            logger.info(
                "[3/4] Assigned %d notes in %.3fs (e.g. string=%d fret=%d)",
                len(tab_notes),
                t1 - t0,
                tab_notes[0].string,
                tab_notes[0].fret,
            )

            # 4. Build output formats
            logger.info("[4/4] Building output files...")
            t0 = time.perf_counter()
            tex = self.tex_builder.build(tab_notes)
            gp5 = self.gp_builder.build(tab_notes)
            t1 = time.perf_counter()
            logger.info(
                "[4/4] Built tex (%d chars) + GP5 (%d bytes) in %.3fs",
                len(tex),
                len(gp5),
                t1 - t0,
            )

            return {
                "tex": tex,
                "gp5": gp5,
                "note_count": len(tab_notes),
            }

        finally:
            try:
                os.unlink(audio_path)
                logger.debug("Cleaned up temp file %s", audio_path)
            except OSError:
                pass
