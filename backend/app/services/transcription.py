import os
import logging
import time

from fastapi import UploadFile

from app.services.audio_processor import AudioProcessor
from app.services.pitch_detector import PitchDetector
from app.services.tab_solver import TabSolver
from app.services.guitarpro_builder import GuitarProBuilder
from app.services.alphatex_builder import AlphaTexBuilder
from app.services.midi_builder import MidiBuilder
from app.services.musicxml_builder import MusicXMLBuilder
from app.services.tempo_detector import detect_tempo
from app.models.guitar import get_tuning, STANDARD_TUNING
from app.config import settings

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

    async def transcribe(
        self,
        file: UploadFile,
        target_fret: int | None = None,
        detection_params: dict | None = None,
        tuning_name: str | None = None,
    ) -> dict:
        tuning = get_tuning(tuning_name)

        # 1. Validate and save uploaded audio
        logger.info("[1/4] Saving uploaded file...")
        audio_path = await self.audio_processor.save_upload(file)
        file_size = audio_path.stat().st_size
        logger.info("[1/4] Saved %s (%d bytes)", audio_path.name, file_size)

        try:
            # 2. Detect notes with Basic Pitch
            logger.info("[2/4] Running pitch detection...")
            t0 = time.perf_counter()
            notes = self.pitch_detector.detect(audio_path, **(detection_params or {}))
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
                empty_midi = MidiBuilder().build([])
                empty_xml = MusicXMLBuilder().build([], tuning)
                return {
                    "tex": self.tex_builder.build_with_tuning([], tuning),
                    "gp5": self.gp_builder.build_with_tuning([], tuning),
                    "midi": empty_midi,
                    "musicxml": empty_xml,
                    "note_count": 0,
                }

            # 3. Solve string/fret assignments
            solver_kwargs = {"tuning": tuning}
            if target_fret is not None:
                solver_kwargs["target_fret"] = target_fret
                logger.info("[3/4] Solving string/fret assignments (target zone: fret %d)...", target_fret)
            else:
                logger.info("[3/4] Solving string/fret assignments (auto zone)...")

            solver = TabSolver(**solver_kwargs)
            t0 = time.perf_counter()
            tab_notes = solver.solve(notes)
            t1 = time.perf_counter()
            logger.info(
                "[3/4] Assigned %d notes in %.3fs (e.g. string=%d fret=%d)",
                len(tab_notes),
                t1 - t0,
                tab_notes[0].string,
                tab_notes[0].fret,
            )

            # 3b. Detect tempo from audio
            detected_tempo = detect_tempo(audio_path)
            tempo = int(detected_tempo) if detected_tempo else settings.tempo_bpm

            # 4. Build output formats
            logger.info("[4/4] Building output files (tempo=%d BPM)...", tempo)
            t0 = time.perf_counter()
            tex_builder = AlphaTexBuilder(tempo=tempo)
            gp_builder = GuitarProBuilder(tempo=tempo)
            midi_builder = MidiBuilder(tempo=tempo)
            xml_builder = MusicXMLBuilder(tempo=tempo)
            tex = tex_builder.build_with_tuning(tab_notes, tuning)
            gp5 = gp_builder.build_with_tuning(tab_notes, tuning)
            midi_data = midi_builder.build(tab_notes)
            musicxml_data = xml_builder.build(tab_notes, tuning)
            t1 = time.perf_counter()
            logger.info(
                "[4/4] Built tex (%d chars) + GP5 (%d bytes) + MIDI (%d bytes) + MusicXML (%d bytes) in %.3fs",
                len(tex),
                len(gp5),
                len(midi_data),
                len(musicxml_data),
                t1 - t0,
            )

            return {
                "tex": tex,
                "gp5": gp5,
                "midi": midi_data,
                "musicxml": musicxml_data,
                "note_count": len(tab_notes),
                "tab_notes": tab_notes,
                "tempo": tempo,
            }

        finally:
            try:
                os.unlink(audio_path)
                logger.debug("Cleaned up temp file %s", audio_path)
            except OSError:
                pass

    def transcribe_from_notes(
        self,
        notes: list,
        target_fret: int | None = None,
        tuning_name: str | None = None,
    ) -> dict:
        """Transcribe from pre-detected notes (e.g. MIDI input), skipping audio + pitch detection."""
        tuning = get_tuning(tuning_name)

        if not notes:
            empty_midi = MidiBuilder().build([])
            empty_xml = MusicXMLBuilder().build([], tuning)
            return {
                "tex": self.tex_builder.build_with_tuning([], tuning),
                "gp5": self.gp_builder.build_with_tuning([], tuning),
                "midi": empty_midi,
                "musicxml": empty_xml,
                "note_count": 0,
            }

        # Solve string/fret assignments
        solver = TabSolver(target_fret=target_fret, tuning=tuning)
        logger.info("Solving string/fret for %d MIDI notes (target_fret=%s, tuning=%s)",
                     len(notes), target_fret, tuning_name or "standard")
        t0 = time.perf_counter()
        tab_notes = solver.solve(notes)
        t1 = time.perf_counter()
        logger.info("Assigned %d notes in %.3fs", len(tab_notes), t1 - t0)

        # Build output formats
        tex = self.tex_builder.build_with_tuning(tab_notes, tuning)
        gp5 = self.gp_builder.build_with_tuning(tab_notes, tuning)
        midi_builder = MidiBuilder()
        xml_builder = MusicXMLBuilder()
        midi_data = midi_builder.build(tab_notes)
        musicxml_data = xml_builder.build(tab_notes, tuning)

        return {
            "tex": tex,
            "gp5": gp5,
            "midi": midi_data,
            "musicxml": musicxml_data,
            "note_count": len(tab_notes),
            "tab_notes": tab_notes,
        }
