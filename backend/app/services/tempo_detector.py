"""
Detect tempo (BPM) from audio files using librosa.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def detect_tempo(audio_path: Path) -> float | None:
    """Detect the tempo of an audio file, returning BPM or None on failure."""
    try:
        import librosa

        y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        # librosa may return an array; extract scalar
        bpm = float(tempo) if not hasattr(tempo, '__len__') else float(tempo[0])

        # Sanity check: reasonable guitar tempo range
        if bpm < 30 or bpm > 300:
            logger.warning("Detected tempo %.1f BPM outside reasonable range, ignoring", bpm)
            return None

        logger.info("Detected tempo: %.1f BPM", bpm)
        return round(bpm, 1)
    except ImportError:
        logger.warning("librosa not installed, skipping tempo detection")
        return None
    except Exception as e:
        logger.warning("Tempo detection failed: %s", e)
        return None
