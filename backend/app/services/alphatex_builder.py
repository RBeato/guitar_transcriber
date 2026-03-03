"""
Generate alphaTab's native alphaTex markup from solver output.

alphaTex is a text-based format that alphaTab can render directly,
avoiding binary GP format compatibility issues.

Format reference: https://alphatab.net/docs/alphatex/introduction
"""

import math
from app.config import settings
from app.models.note_event import TabNote
from app.models.guitar import STANDARD_TUNING


# Duration in seconds -> alphaTex duration value
# alphaTex uses: 1=whole, 2=half, 4=quarter, 8=eighth, 16=sixteenth, etc.
DURATION_THRESHOLDS = [
    (1.5, 1),    # whole
    (0.75, 2),   # half
    (0.375, 4),  # quarter
    (0.1875, 8), # eighth
    (0.09, 16),  # sixteenth
    (0.0, 32),   # thirty-second
]


_NOTE_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]


def _midi_to_alphatex_note(midi_pitch: int) -> str:
    """Convert a MIDI pitch to alphaTex tuning notation (e.g., 64 -> 'e5')."""
    octave = (midi_pitch // 12) - 1
    note = _NOTE_NAMES[midi_pitch % 12]
    return f"{note}{octave}"


def _tuning_to_alphatex(tuning: dict[int, int]) -> str:
    """Convert a tuning dict to alphaTex tuning string (string 1 first)."""
    return " ".join(
        _midi_to_alphatex_note(tuning[s])
        for s in sorted(tuning.keys())
    )


class AlphaTexBuilder:
    """Converts TabNote list to an alphaTex string."""

    def __init__(self, tempo: int = settings.tempo_bpm):
        self.tempo = tempo

    def build(self, tab_notes: list[TabNote]) -> str:
        return self.build_with_tuning(tab_notes, STANDARD_TUNING)

    def build_with_tuning(self, tab_notes: list[TabNote], tuning: dict[int, int]) -> str:
        if not tab_notes:
            return r"\title 'Guitar Transcription' \tempo 120 . 1 r"

        tuning_str = _tuning_to_alphatex(tuning)
        lines = [
            r"\title 'Guitar Transcription'",
            rf"\tempo {self.tempo}",
            r"\instrument 25",
            rf"\tuning {tuning_str}",
            ".",
        ]

        # Group notes into beats (simultaneous notes)
        beats = self._group_into_beats(tab_notes)

        for beat_notes, duration in beats:
            if len(beat_notes) == 1:
                n = beat_notes[0]
                lines.append(f"{n.fret}.{n.string}.{duration}")
            else:
                # Chord: (fret.string fret.string).duration
                chord_parts = " ".join(f"{n.fret}.{n.string}" for n in beat_notes)
                lines.append(f"({chord_parts}).{duration}")

        return " ".join(lines)

    def _group_into_beats(
        self, tab_notes: list[TabNote]
    ) -> list[tuple[list[TabNote], int]]:
        """Group simultaneous notes and quantize durations."""
        sorted_notes = sorted(tab_notes, key=lambda n: (n.start_time, n.string))

        groups: list[tuple[list[TabNote], int]] = []
        current: list[TabNote] = [sorted_notes[0]]
        window = settings.chord_window_ms / 1000.0

        for note in sorted_notes[1:]:
            if note.start_time - current[0].start_time <= window:
                current.append(note)
            else:
                dur = self._quantize_duration(current)
                groups.append((current, dur))
                current = [note]

        dur = self._quantize_duration(current)
        groups.append((current, dur))
        return groups

    @staticmethod
    def _quantize_duration(notes: list[TabNote]) -> int:
        """Pick the closest standard note duration for a group of notes."""
        avg_dur = sum(n.end_time - n.start_time for n in notes) / len(notes)
        for threshold, value in DURATION_THRESHOLDS:
            if avg_dur >= threshold:
                return value
        return 32
