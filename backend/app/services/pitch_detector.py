import logging
from pathlib import Path

import numpy as np

from app.config import settings
from app.models.note_event import NoteEvent
from app.models.guitar import GUITAR_MIN_MIDI, GUITAR_MAX_MIDI

logger = logging.getLogger(__name__)

# Use the ONNX model explicitly — the default model path resolution
# fails with TF 2.20+ due to saved model format incompatibility.
_ONNX_MODEL: Path | None = None


def _find_onnx_model() -> Path | None:
    try:
        import basic_pitch
        model_dir = Path(basic_pitch.__file__).parent / "saved_models" / "icassp_2022"
        onnx_path = model_dir / "nmp.onnx"
        if onnx_path.exists():
            return onnx_path
    except Exception:
        pass
    return None


class PitchDetector:
    """Wraps Spotify's Basic Pitch for polyphonic note detection."""

    @staticmethod
    def preload():
        global _ONNX_MODEL
        try:
            _ONNX_MODEL = _find_onnx_model()
            if _ONNX_MODEL:
                logger.info(f"Basic Pitch ONNX model found: {_ONNX_MODEL}")
            else:
                logger.warning("Basic Pitch ONNX model not found, will use default")
            from basic_pitch.inference import predict  # noqa: F401
            logger.info("Basic Pitch module preloaded successfully")
        except Exception as e:
            logger.warning(f"Could not preload Basic Pitch: {e}")

    def detect(
        self,
        audio_path: Path,
        onset_threshold: float | None = None,
        frame_threshold: float | None = None,
        minimum_note_length: float | None = None,
        minimum_velocity: float | None = None,
        merge_tolerance_ms: float | None = None,
    ) -> list[NoteEvent]:
        from basic_pitch.inference import predict

        global _ONNX_MODEL
        if _ONNX_MODEL is None:
            _ONNX_MODEL = _find_onnx_model()

        # Use per-request overrides or fall back to global settings
        _onset = onset_threshold if onset_threshold is not None else settings.onset_threshold
        _frame = frame_threshold if frame_threshold is not None else settings.frame_threshold
        _min_len = minimum_note_length if minimum_note_length is not None else settings.minimum_note_length
        _min_vel = minimum_velocity if minimum_velocity is not None else settings.minimum_velocity
        _merge_ms = merge_tolerance_ms if merge_tolerance_ms is not None else settings.merge_tolerance_ms

        model_output, midi_data, note_events = predict(
            str(audio_path),
            model_or_model_path=_ONNX_MODEL,
            onset_threshold=_onset,
            frame_threshold=_frame,
            minimum_note_length=_min_len,
        )

        raw_count = len(note_events)
        notes: list[NoteEvent] = []

        for start, end, pitch, velocity, *_ in note_events:
            midi_pitch = int(pitch)
            vel = float(np.clip(velocity, 0.0, 1.0))

            # Filter: guitar range only
            if midi_pitch < GUITAR_MIN_MIDI or midi_pitch > GUITAR_MAX_MIDI:
                continue

            # Filter: minimum velocity (drops harmonics/noise)
            if vel < _min_vel:
                continue

            notes.append(
                NoteEvent(
                    start_time=float(start),
                    end_time=float(end),
                    midi_pitch=midi_pitch,
                    velocity=vel,
                )
            )

        # Remove duplicate pitches that overlap in time (common with harmonics)
        notes = self._deduplicate(notes)

        # Merge same-pitch notes separated by a small gap
        notes = self._merge_close_notes(notes, _merge_ms)

        notes.sort(key=lambda n: (n.start_time, n.midi_pitch))
        logger.info(
            "Pitch detection: %d raw -> %d after filtering (range/velocity/dedup/merge)",
            raw_count,
            len(notes),
        )
        return notes

    @staticmethod
    def _merge_close_notes(notes: list[NoteEvent], tolerance_ms: float) -> list[NoteEvent]:
        """Merge same-pitch notes separated by a small gap (<= tolerance_ms)."""
        if len(notes) <= 1 or tolerance_ms <= 0:
            return notes

        tolerance_s = tolerance_ms / 1000.0
        sorted_notes = sorted(notes, key=lambda n: (n.midi_pitch, n.start_time))
        merged: list[NoteEvent] = [sorted_notes[0]]

        for note in sorted_notes[1:]:
            prev = merged[-1]
            if (
                note.midi_pitch == prev.midi_pitch
                and (note.start_time - prev.end_time) <= tolerance_s
            ):
                # Merge: extend end_time, keep max velocity
                merged[-1] = NoteEvent(
                    start_time=prev.start_time,
                    end_time=max(prev.end_time, note.end_time),
                    midi_pitch=prev.midi_pitch,
                    velocity=max(prev.velocity, note.velocity),
                )
            else:
                merged.append(note)

        return merged

    @staticmethod
    def _deduplicate(notes: list[NoteEvent]) -> list[NoteEvent]:
        """Remove near-duplicate notes (same pitch, overlapping time)."""
        if len(notes) <= 1:
            return notes

        sorted_notes = sorted(notes, key=lambda n: (n.midi_pitch, n.start_time))
        kept: list[NoteEvent] = [sorted_notes[0]]

        for note in sorted_notes[1:]:
            prev = kept[-1]
            # Same pitch and starts before previous ends -> duplicate
            if note.midi_pitch == prev.midi_pitch and note.start_time < prev.end_time:
                # Keep the longer one
                if note.duration > prev.duration:
                    kept[-1] = note
            else:
                kept.append(note)

        return kept
