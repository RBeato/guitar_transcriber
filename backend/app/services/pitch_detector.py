import logging
from pathlib import Path

import numpy as np

from app.config import settings
from app.models.note_event import NoteEvent

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

    def detect(self, audio_path: Path) -> list[NoteEvent]:
        from basic_pitch.inference import predict

        global _ONNX_MODEL
        if _ONNX_MODEL is None:
            _ONNX_MODEL = _find_onnx_model()

        model_output, midi_data, note_events = predict(
            str(audio_path),
            model_or_model_path=_ONNX_MODEL,
            onset_threshold=settings.onset_threshold,
            frame_threshold=settings.frame_threshold,
            minimum_note_length=settings.minimum_note_length,
        )

        notes: list[NoteEvent] = []
        for start, end, pitch, velocity, *_ in note_events:
            notes.append(
                NoteEvent(
                    start_time=float(start),
                    end_time=float(end),
                    midi_pitch=int(pitch),
                    velocity=float(np.clip(velocity, 0.0, 1.0)),
                )
            )

        notes.sort(key=lambda n: (n.start_time, n.midi_pitch))
        return notes
