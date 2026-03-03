"""
Generate standard MIDI files from solver output using pretty_midi.
"""
import io

import pretty_midi

from app.config import settings
from app.models.note_event import TabNote


class MidiBuilder:
    """Converts TabNote list to a standard MIDI file."""

    def __init__(self, tempo: int = settings.tempo_bpm):
        self.tempo = tempo

    def build(self, tab_notes: list[TabNote]) -> bytes:
        midi = pretty_midi.PrettyMIDI(initial_tempo=self.tempo)
        guitar = pretty_midi.Instrument(program=25, name="Guitar")  # Acoustic Guitar (steel)

        for note in tab_notes:
            midi_note = pretty_midi.Note(
                velocity=int(note.velocity * 127),
                pitch=note.midi_pitch,
                start=note.start_time,
                end=note.end_time,
            )
            guitar.notes.append(midi_note)

        midi.instruments.append(guitar)

        buf = io.BytesIO()
        midi.write(buf)
        return buf.getvalue()
