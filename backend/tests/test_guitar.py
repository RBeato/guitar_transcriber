from app.models.guitar import candidates_for_pitch, STANDARD_TUNING


def test_open_low_e():
    """MIDI 40 (E2) should be playable on string 6 fret 0."""
    candidates = candidates_for_pitch(40)
    assert (6, 0) in candidates


def test_open_high_e():
    """MIDI 64 (E4) should be playable on string 1 fret 0."""
    candidates = candidates_for_pitch(64)
    assert (1, 0) in candidates


def test_multiple_positions():
    """A note playable on multiple strings."""
    # MIDI 60 = C4 = string 2 fret 1, string 3 fret 5
    candidates = candidates_for_pitch(60)
    assert (2, 1) in candidates
    assert (3, 5) in candidates


def test_out_of_range_high():
    """MIDI 100 is too high for guitar."""
    candidates = candidates_for_pitch(100)
    assert len(candidates) == 0


def test_out_of_range_low():
    """MIDI 30 is too low for standard tuning guitar."""
    candidates = candidates_for_pitch(30)
    assert len(candidates) == 0


def test_all_tuning_open_strings():
    """Each open string pitch should be a valid candidate."""
    for string_num, midi_pitch in STANDARD_TUNING.items():
        candidates = candidates_for_pitch(midi_pitch)
        assert (string_num, 0) in candidates
