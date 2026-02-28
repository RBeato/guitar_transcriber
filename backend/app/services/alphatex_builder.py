"""
Generate alphaTab's native alphaTex markup from solver output.

alphaTex is a text-based format that alphaTab can render directly,
avoiding binary GP format compatibility issues.

Format reference: https://alphatab.net/docs/alphatex/introduction
"""

import math
from app.config import settings
from app.models.note_event import TabNote


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


class AlphaTexBuilder:
    """Converts TabNote list to an alphaTex string."""

    def __init__(self, tempo: int = settings.tempo_bpm):
        self.tempo = tempo

    def build(self, tab_notes: list[TabNote]) -> str:
        if not tab_notes:
            return r"\title 'Guitar Transcription' \tempo 120 . 1 r"

        lines = [
            r"\title 'Guitar Transcription'",
            rf"\tempo {self.tempo}",
            r"\instrument 25",
            r"\tuning e5 b4 g4 d4 a3 e3",
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
