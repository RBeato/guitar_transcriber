"""
Build Guitar Pro 5 files from solver output using pyguitarpro.

Quantizes continuous time to beat positions and constructs
the GP5 data model: Song -> Track -> Measure -> Voice -> Beat -> Note.
"""

import io
import math

import guitarpro
from guitarpro import models

from app.config import settings
from app.models.note_event import TabNote
from app.models.guitar import STANDARD_TUNING


# Duration value -> ticks mapping (at 960 ticks per beat / quarter note)
DURATION_MAP = [
    (960 * 4, 1),   # whole
    (960 * 2, 2),   # half
    (960, 4),        # quarter
    (480, 8),        # eighth
    (240, 16),       # sixteenth
    (120, 32),       # thirty-second
    (60, 64),        # sixty-fourth
]


class GuitarProBuilder:
    """Converts TabNote list to a GP5 binary file."""

    def __init__(self, tempo: int = settings.tempo_bpm, ticks_per_beat: int = settings.ticks_per_beat):
        self.tempo = tempo
        self.ticks_per_beat = ticks_per_beat
        self.ticks_per_second = (tempo * ticks_per_beat) / 60.0

    def build(self, tab_notes: list[TabNote]) -> bytes:
        song = models.Song()
        song.title = "Guitar Transcription"
        song.tempo = self.tempo

        # Configure guitar track
        track = song.tracks[0]
        track.name = "Guitar"
        track.channel.instrument = 25  # Acoustic Guitar (steel)
        track.isPercussionTrack = False
        track.strings = [
            models.GuitarString(s, p)
            for s, p in sorted(STANDARD_TUNING.items())
        ]

        if not tab_notes:
            return self._serialize(song)

        # Convert notes to tick positions
        tick_notes = []
        for note in tab_notes:
            start_tick = int(note.start_time * self.ticks_per_second)
            end_tick = int(note.end_time * self.ticks_per_second)
            duration_ticks = max(end_tick - start_tick, 60)
            tick_notes.append((start_tick, duration_ticks, note))

        # Group simultaneous notes into beats
        beats_data = self._group_into_beats(tick_notes)

        # Calculate how many measures we need (4/4 time)
        ticks_per_measure = self.ticks_per_beat * 4
        total_ticks = max(start + dur for start, dur, _ in tick_notes)
        num_measures = max(1, math.ceil(total_ticks / ticks_per_measure))

        # Ensure we have enough measures (must add both headers AND track measures)
        while len(song.measureHeaders) < num_measures:
            header = models.MeasureHeader()
            song.addMeasureHeader(header)
            for t in song.tracks:
                t.measures.append(models.Measure(t, header))

        # Place beats into measures
        for beat_start, beat_notes in beats_data:
            measure_idx = min(beat_start // ticks_per_measure, num_measures - 1)
            measure = track.measures[measure_idx]
            voice = measure.voices[0]

            beat = models.Beat(voice)
            # Duration from the first note in the group
            _, dur_ticks, _ = beat_notes[0]
            beat.duration = models.Duration(value=self._quantize_duration_value(dur_ticks))

            for _, _, tab_note in beat_notes:
                note = models.Note(beat)
                note.string = tab_note.string
                note.value = tab_note.fret
                note.velocity = int(tab_note.velocity * 127)
                beat.notes.append(note)

            voice.beats.append(beat)

        return self._serialize(song)

    def _group_into_beats(
        self, tick_notes: list[tuple[int, int, TabNote]]
    ) -> list[tuple[int, list[tuple[int, int, TabNote]]]]:
        """Group notes with the same (or very close) start tick into beats."""
        if not tick_notes:
            return []

        sorted_notes = sorted(tick_notes, key=lambda x: x[0])
        groups: list[tuple[int, list[tuple[int, int, TabNote]]]] = []
        current_start = sorted_notes[0][0]
        current_group: list[tuple[int, int, TabNote]] = [sorted_notes[0]]
        tolerance = 30  # ticks

        for tn in sorted_notes[1:]:
            if abs(tn[0] - current_start) <= tolerance:
                current_group.append(tn)
            else:
                groups.append((current_start, current_group))
                current_start = tn[0]
                current_group = [tn]

        groups.append((current_start, current_group))
        return groups

    @staticmethod
    def _quantize_duration_value(ticks: int) -> int:
        """Find the closest standard note duration value for a tick count."""
        best_value = 64  # shortest
        best_diff = float("inf")

        for ref_ticks, value in DURATION_MAP:
            diff = abs(ticks - ref_ticks)
            if diff < best_diff:
                best_diff = diff
                best_value = value

        return best_value

    @staticmethod
    def _serialize(song: models.Song) -> bytes:
        buf = io.BytesIO()
        guitarpro.write(song, buf, version=(5, 1, 0))
        return buf.getvalue()
