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

# Common alternative tunings
TUNING_PRESETS: dict[str, dict[int, int]] = {
    "standard": STANDARD_TUNING,
    "drop_d": {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 38},      # D2
    "open_g": {1: 62, 2: 59, 3: 55, 4: 50, 5: 43, 6: 38},       # D-G-D-G-B-D
    "open_d": {1: 62, 2: 57, 3: 54, 4: 50, 5: 45, 6: 38},       # D-A-D-F#-A-D
    "dadgad": {1: 62, 2: 57, 3: 55, 4: 50, 5: 45, 6: 38},       # D-A-D-G-A-D
    "open_e": {1: 64, 2: 59, 3: 56, 4: 52, 5: 47, 6: 40},       # E-B-E-G#-B-E
    "half_step_down": {1: 63, 2: 58, 3: 54, 4: 49, 5: 44, 6: 39}, # Eb standard
    "full_step_down": {1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 38}, # D standard
    "drop_c": {1: 62, 2: 57, 3: 53, 4: 48, 5: 43, 6: 36},       # C-G-C-F-A-D
}

# Guitar MIDI range (adjusted for lowest tuning in presets)
GUITAR_MIN_MIDI = 36   # C2 (Drop C low string)
GUITAR_MAX_MIDI = 88   # E6 (high E, fret 24)

NUM_STRINGS = 6
MAX_FRET = 24


def get_tuning(name: str | None = None) -> dict[int, int]:
    """Get a tuning by preset name, defaulting to standard."""
    if name is None or name not in TUNING_PRESETS:
        return STANDARD_TUNING
    return TUNING_PRESETS[name]


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
