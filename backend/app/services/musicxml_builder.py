"""
Generate MusicXML from solver output.
Simple builder that produces valid MusicXML 4.0 for guitar tablature.
"""
import math
from xml.etree.ElementTree import Element, SubElement, tostring

from app.config import settings
from app.models.note_event import TabNote
from app.models.guitar import STANDARD_TUNING


# Duration in seconds -> MusicXML type
DURATION_TYPES = [
    (1.5, "whole", 4),
    (0.75, "half", 2),
    (0.375, "quarter", 1),
    (0.1875, "eighth", 0.5),
    (0.09, "16th", 0.25),
    (0.0, "32nd", 0.125),
]

# MIDI pitch to note name mapping
_NOTE_NAMES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
_ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]


def _midi_to_pitch(midi_pitch: int) -> tuple[str, int, int]:
    """Convert MIDI pitch to (step, alter, octave)."""
    octave = (midi_pitch // 12) - 1
    idx = midi_pitch % 12
    return _NOTE_NAMES[idx], _ALTERS[idx], octave


class MusicXMLBuilder:
    """Converts TabNote list to MusicXML bytes."""

    def __init__(self, tempo: int = settings.tempo_bpm):
        self.tempo = tempo

    def build(self, tab_notes: list[TabNote], tuning: dict[int, int] | None = None) -> bytes:
        if tuning is None:
            tuning = STANDARD_TUNING

        root = Element("score-partwise", version="4.0")

        # Part list
        part_list = SubElement(root, "part-list")
        score_part = SubElement(part_list, "score-part", id="P1")
        SubElement(score_part, "part-name").text = "Guitar"

        # Part
        part = SubElement(root, "part", id="P1")

        if not tab_notes:
            # Empty measure
            measure = SubElement(part, "measure", number="1")
            self._add_attributes(measure)
            self._add_direction(measure)
            note_el = SubElement(measure, "note")
            SubElement(note_el, "rest")
            SubElement(note_el, "duration").text = "4"
            SubElement(note_el, "type").text = "whole"
            return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(root, encoding="unicode").encode("utf-8")

        # Group notes into beats
        beats = self._group_into_beats(tab_notes)

        # Calculate measures (4/4)
        divisions = 1  # quarter note = 1 division
        beats_per_measure = 4
        total_beats = sum(dur for _, dur in beats)
        num_measures = max(1, math.ceil(total_beats / beats_per_measure))

        beat_idx = 0
        for m in range(num_measures):
            measure = SubElement(part, "measure", number=str(m + 1))

            if m == 0:
                self._add_attributes(measure)
                self._add_direction(measure)

            # Place beats in this measure
            measure_beat_count = 0.0
            while beat_idx < len(beats) and measure_beat_count < beats_per_measure:
                beat_notes, duration_beats = beats[beat_idx]
                is_chord = len(beat_notes) > 1

                for i, tn in enumerate(beat_notes):
                    note_el = SubElement(measure, "note")

                    if i > 0:
                        SubElement(note_el, "chord")

                    # Pitch
                    step, alter, octave = _midi_to_pitch(tn.midi_pitch)
                    pitch_el = SubElement(note_el, "pitch")
                    SubElement(pitch_el, "step").text = step
                    if alter != 0:
                        SubElement(pitch_el, "alter").text = str(alter)
                    SubElement(pitch_el, "octave").text = str(octave)

                    SubElement(note_el, "duration").text = str(max(1, int(duration_beats)))

                    # Type
                    type_name = self._quantize_type(duration_beats)
                    SubElement(note_el, "type").text = type_name

                    # Technical notation (string/fret)
                    notations = SubElement(note_el, "notations")
                    technical = SubElement(notations, "technical")
                    SubElement(technical, "string").text = str(tn.string)
                    SubElement(technical, "fret").text = str(tn.fret)

                measure_beat_count += duration_beats
                beat_idx += 1

        xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n'
        xml_str += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
        xml_str += tostring(root, encoding="unicode")
        return xml_str.encode("utf-8")

    def _add_attributes(self, measure: Element):
        attrs = SubElement(measure, "attributes")
        SubElement(attrs, "divisions").text = "1"
        time_el = SubElement(attrs, "time")
        SubElement(time_el, "beats").text = "4"
        SubElement(time_el, "beat-type").text = "4"
        clef = SubElement(attrs, "clef")
        SubElement(clef, "sign").text = "TAB"
        SubElement(clef, "line").text = "5"

    def _add_direction(self, measure: Element):
        direction = SubElement(measure, "direction", placement="above")
        dt = SubElement(direction, "direction-type")
        metronome = SubElement(dt, "metronome")
        SubElement(metronome, "beat-unit").text = "quarter"
        SubElement(metronome, "per-minute").text = str(self.tempo)
        SubElement(direction, "sound", tempo=str(self.tempo))

    def _group_into_beats(self, tab_notes: list[TabNote]) -> list[tuple[list[TabNote], float]]:
        """Group simultaneous notes and return with duration in beats."""
        sorted_notes = sorted(tab_notes, key=lambda n: (n.start_time, n.string))
        window = settings.chord_window_ms / 1000.0

        groups: list[tuple[list[TabNote], float]] = []
        current: list[TabNote] = [sorted_notes[0]]

        for note in sorted_notes[1:]:
            if note.start_time - current[0].start_time <= window:
                current.append(note)
            else:
                dur_beats = self._duration_in_beats(current)
                groups.append((current, dur_beats))
                current = [note]

        dur_beats = self._duration_in_beats(current)
        groups.append((current, dur_beats))
        return groups

    def _duration_in_beats(self, notes: list[TabNote]) -> float:
        avg_dur = sum(n.end_time - n.start_time for n in notes) / len(notes)
        beat_duration = 60.0 / self.tempo  # seconds per beat
        return max(0.25, round(avg_dur / beat_duration * 4) / 4)  # quantize to quarter beats

    @staticmethod
    def _quantize_type(duration_beats: float) -> str:
        if duration_beats >= 4:
            return "whole"
        elif duration_beats >= 2:
            return "half"
        elif duration_beats >= 1:
            return "quarter"
        elif duration_beats >= 0.5:
            return "eighth"
        elif duration_beats >= 0.25:
            return "16th"
        return "32nd"
