from app.models.note_event import NoteEvent
from app.services.tab_solver import TabSolver


def make_note(start: float, end: float, pitch: int, velocity: float = 0.8) -> NoteEvent:
    return NoteEvent(start_time=start, end_time=end, midi_pitch=pitch, velocity=velocity)


def test_empty_input():
    solver = TabSolver()
    result = solver.solve([])
    assert result == []


def test_single_note():
    solver = TabSolver()
    notes = [make_note(0.0, 0.5, 64)]  # E4 = string 1 fret 0
    result = solver.solve(notes)
    assert len(result) == 1
    assert result[0].string == 1
    assert result[0].fret == 0


def test_single_note_open_low_e():
    solver = TabSolver()
    notes = [make_note(0.0, 0.5, 40)]  # E2 = string 6 fret 0
    result = solver.solve(notes)
    assert len(result) == 1
    assert result[0].string == 6
    assert result[0].fret == 0


def test_chord():
    """E minor chord: E2, B2, E3, G3, B3, E4."""
    solver = TabSolver()
    notes = [
        make_note(0.0, 1.0, 40),  # E2
        make_note(0.0, 1.0, 47),  # B2
        make_note(0.0, 1.0, 52),  # E3
        make_note(0.0, 1.0, 55),  # G3
        make_note(0.0, 1.0, 59),  # B3
        make_note(0.0, 1.0, 64),  # E4
    ]
    result = solver.solve(notes)
    assert len(result) == 6

    # All should be on different strings
    strings = {n.string for n in result}
    assert len(strings) == 6


def test_sequential_notes_prefer_smooth_movement():
    """Sequential notes near each other should stay in a similar position."""
    solver = TabSolver()
    # C major scale on one string area
    notes = [
        make_note(0.0, 0.5, 60),  # C4
        make_note(0.5, 1.0, 62),  # D4
        make_note(1.0, 1.5, 64),  # E4
    ]
    result = solver.solve(notes)
    assert len(result) == 3

    # Check fret movement is smooth (no big jumps)
    frets = [n.fret for n in result]
    for i in range(1, len(frets)):
        assert abs(frets[i] - frets[i - 1]) <= 5


def test_preserves_timing():
    """Solver should preserve original note timing."""
    solver = TabSolver()
    notes = [make_note(1.5, 2.0, 55)]
    result = solver.solve(notes)
    assert result[0].start_time == 1.5
    assert result[0].end_time == 2.0
