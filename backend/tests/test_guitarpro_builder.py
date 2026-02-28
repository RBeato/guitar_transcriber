from app.models.note_event import TabNote
from app.services.guitarpro_builder import GuitarProBuilder


def test_empty_build():
    builder = GuitarProBuilder()
    data = builder.build([])
    assert isinstance(data, bytes)
    assert len(data) > 0


def test_single_note_build():
    builder = GuitarProBuilder()
    notes = [
        TabNote(
            start_time=0.0,
            end_time=0.5,
            midi_pitch=64,
            velocity=0.8,
            string=1,
            fret=0,
        )
    ]
    data = builder.build(notes)
    assert isinstance(data, bytes)
    assert len(data) > 100  # GP5 files have substantial headers


def test_chord_build():
    builder = GuitarProBuilder()
    notes = [
        TabNote(0.0, 1.0, 40, 0.8, string=6, fret=0),
        TabNote(0.0, 1.0, 47, 0.8, string=5, fret=2),
        TabNote(0.0, 1.0, 52, 0.8, string=4, fret=2),
        TabNote(0.0, 1.0, 55, 0.8, string=3, fret=0),
        TabNote(0.0, 1.0, 59, 0.8, string=2, fret=0),
        TabNote(0.0, 1.0, 64, 0.8, string=1, fret=0),
    ]
    data = builder.build(notes)
    assert isinstance(data, bytes)
    assert len(data) > 100
