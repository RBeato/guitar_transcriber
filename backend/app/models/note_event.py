from dataclasses import dataclass


@dataclass
class NoteEvent:
    start_time: float  # seconds
    end_time: float    # seconds
    midi_pitch: int    # MIDI note number (0-127)
    velocity: float    # 0.0-1.0

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


@dataclass
class TabNote:
    """A note with string/fret assignment."""
    start_time: float
    end_time: float
    midi_pitch: int
    velocity: float
    string: int  # 1-6
    fret: int    # 0-24
