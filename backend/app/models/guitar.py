# Standard guitar tuning: string number -> MIDI pitch (open string)
# String 1 = high E (64), String 6 = low E (40)
STANDARD_TUNING: dict[int, int] = {
    1: 64,  # E4
    2: 59,  # B3
    3: 55,  # G3
    4: 50,  # D3
    5: 45,  # A2
    6: 40,  # E2
}

# Guitar MIDI range
GUITAR_MIN_MIDI = 40   # E2 (low E open)
GUITAR_MAX_MIDI = 88   # E6 (high E, fret 24)

NUM_STRINGS = 6
MAX_FRET = 24


def candidates_for_pitch(midi_pitch: int, tuning: dict[int, int] | None = None) -> list[tuple[int, int]]:
    """Return all valid (string, fret) pairs for a given MIDI pitch."""
    if tuning is None:
        tuning = STANDARD_TUNING

    results = []
    for string_num, open_pitch in tuning.items():
        fret = midi_pitch - open_pitch
        if 0 <= fret <= MAX_FRET:
            results.append((string_num, fret))
    return results
