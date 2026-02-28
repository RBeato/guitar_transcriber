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


def test_target_fret_zone():
    """With target_fret=5, notes should be placed near fret 5."""
    solver = TabSolver(target_fret=5)
    # A4 = MIDI 69 — can be played at string 1 fret 5 or string 2 fret 10
    notes = [make_note(0.0, 0.5, 69)]
    result = solver.solve(notes)
    assert len(result) == 1
    # Should prefer fret 5 over fret 10
    assert result[0].fret == 5
    assert result[0].string == 1


def test_target_fret_zone_high():
    """With target_fret=7, D major scale should cluster around fret 7."""
    solver = TabSolver(target_fret=7)
    # D major scale: D4, E4, F#4, G4, A4, B4, C#5, D5
    notes = [
        make_note(0.0, 0.3, 62),   # D4
        make_note(0.3, 0.6, 64),   # E4
        make_note(0.6, 0.9, 66),   # F#4
        make_note(0.9, 1.2, 67),   # G4
        make_note(1.2, 1.5, 69),   # A4
        make_note(1.5, 1.8, 71),   # B4
        make_note(1.8, 2.1, 73),   # C#5
        make_note(2.1, 2.4, 74),   # D5
    ]
    result = solver.solve(notes)
    assert len(result) == 8
    frets = [n.fret for n in result]
    avg_fret = sum(frets) / len(frets)
    # Average fret should be near 7 (within ~4 frets)
    assert 3 <= avg_fret <= 11


def test_position_stickiness():
    """Sequential notes should stay in the same position even if cheaper individually."""
    solver = TabSolver()
    # Play notes that could be open strings OR fretted, but proximity should keep them together
    notes = [
        make_note(0.0, 0.5, 62),   # D4 — string 2 fret 3 or string 3 fret 7
        make_note(0.5, 1.0, 64),   # E4 — string 1 fret 0 or string 2 fret 5
        make_note(1.0, 1.5, 62),   # D4 again
    ]
    result = solver.solve(notes)
    assert len(result) == 3
    # The two D4 notes should get the same assignment (position stickiness)
    assert result[0].string == result[2].string
    assert result[0].fret == result[2].fret
