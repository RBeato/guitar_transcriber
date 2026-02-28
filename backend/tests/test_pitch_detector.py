"""Tests for PitchDetector filtering methods (no Basic Pitch model needed)."""

from app.models.note_event import NoteEvent
from app.services.pitch_detector import PitchDetector


def make_note(start: float, end: float, pitch: int, velocity: float = 0.8) -> NoteEvent:
    return NoteEvent(start_time=start, end_time=end, midi_pitch=pitch, velocity=velocity)


class TestMergeCloseNotes:
    def test_empty_list(self):
        assert PitchDetector._merge_close_notes([], 30) == []

    def test_single_note(self):
        notes = [make_note(0.0, 0.5, 60)]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 1

    def test_no_merge_different_pitch(self):
        notes = [
            make_note(0.0, 0.5, 60),
            make_note(0.52, 1.0, 62),  # different pitch, close gap
        ]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 2

    def test_merge_same_pitch_within_tolerance(self):
        notes = [
            make_note(0.0, 0.5, 60, 0.7),
            make_note(0.52, 1.0, 60, 0.9),  # same pitch, 20ms gap
        ]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 1
        assert result[0].start_time == 0.0
        assert result[0].end_time == 1.0
        assert result[0].velocity == 0.9  # keeps max velocity
        assert result[0].midi_pitch == 60

    def test_no_merge_beyond_tolerance(self):
        notes = [
            make_note(0.0, 0.5, 60),
            make_note(0.6, 1.0, 60),  # same pitch, 100ms gap
        ]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 2

    def test_chain_merge(self):
        """Three close notes of same pitch should merge into one."""
        notes = [
            make_note(0.0, 0.3, 64, 0.5),
            make_note(0.32, 0.6, 64, 0.8),  # 20ms gap
            make_note(0.62, 1.0, 64, 0.6),  # 20ms gap
        ]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 1
        assert result[0].start_time == 0.0
        assert result[0].end_time == 1.0
        assert result[0].velocity == 0.8

    def test_zero_tolerance_no_merge(self):
        notes = [
            make_note(0.0, 0.5, 60),
            make_note(0.52, 1.0, 60),
        ]
        result = PitchDetector._merge_close_notes(notes, 0)
        assert len(result) == 2

    def test_mixed_pitches(self):
        notes = [
            make_note(0.0, 0.5, 60, 0.7),
            make_note(0.1, 0.6, 64, 0.8),
            make_note(0.52, 1.0, 60, 0.9),  # merge with first 60
            make_note(0.62, 1.1, 64, 0.6),  # merge with first 64
        ]
        result = PitchDetector._merge_close_notes(notes, 30)
        assert len(result) == 2
        pitches = sorted([n.midi_pitch for n in result])
        assert pitches == [60, 64]


class TestDeduplicate:
    def test_empty(self):
        assert PitchDetector._deduplicate([]) == []

    def test_no_duplicates(self):
        notes = [
            make_note(0.0, 0.5, 60),
            make_note(0.6, 1.0, 62),
        ]
        result = PitchDetector._deduplicate(notes)
        assert len(result) == 2

    def test_overlapping_same_pitch_keeps_longer(self):
        notes = [
            make_note(0.0, 0.3, 60),  # shorter
            make_note(0.1, 0.8, 60),  # longer, overlaps
        ]
        result = PitchDetector._deduplicate(notes)
        assert len(result) == 1
        assert result[0].end_time == 0.8
