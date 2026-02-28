"""
Viterbi-style DP solver for assigning (string, fret) to detected notes.

Algorithm:
1. Group simultaneous notes into chords (within a time window).
2. Generate all valid (string, fret) assignments per chord.
3. DP across chord sequence, minimizing cost:
   - Position jump between consecutive chords
   - Internal fret stretch within a chord
   - Slight penalty for high frets (prefer lower positions)
4. Backtrack for optimal assignment path.
"""

from itertools import product
from dataclasses import dataclass

from app.config import settings
from app.models.note_event import NoteEvent, TabNote
from app.models.guitar import candidates_for_pitch, NUM_STRINGS


@dataclass
class ChordGroup:
    """A group of simultaneous notes."""
    start_time: float
    notes: list[NoteEvent]


# A chord assignment: list of (string, fret) matching each note in the chord
type ChordAssignment = list[tuple[int, int]]

INF = float("inf")


class TabSolver:
    """DP-based solver for optimal string/fret assignment."""

    def __init__(
        self,
        chord_window_ms: float = settings.chord_window_ms,
        max_fret_span: int = settings.max_fret_span,
        position_jump_weight: float = settings.position_jump_weight,
        stretch_weight: float = settings.stretch_weight,
        high_fret_weight: float = settings.high_fret_penalty_weight,
        max_combos: int = 50,
    ):
        self.chord_window = chord_window_ms / 1000.0
        self.max_fret_span = max_fret_span
        self.position_jump_weight = position_jump_weight
        self.stretch_weight = stretch_weight
        self.high_fret_weight = high_fret_weight
        self.max_combos = max_combos

    def solve(self, notes: list[NoteEvent]) -> list[TabNote]:
        if not notes:
            return []

        # Step 1: Group into chords
        chords = self._group_chords(notes)

        # Step 2: Generate valid assignments per chord
        all_assignments: list[list[ChordAssignment]] = []
        for chord in chords:
            assignments = self._generate_assignments(chord)
            if not assignments:
                # Fallback: if no valid assignment, use best individual candidates
                assignments = [self._fallback_assignment(chord)]
            all_assignments.append(assignments)

        # Step 3: Viterbi DP
        n = len(chords)
        # dp[i][j] = min cost to reach chord i with assignment j
        dp: list[list[float]] = [[INF] * len(all_assignments[i]) for i in range(n)]
        back: list[list[int]] = [[-1] * len(all_assignments[i]) for i in range(n)]

        # Initialize first chord
        for j, assign in enumerate(all_assignments[0]):
            dp[0][j] = self._internal_cost(assign)

        # Fill DP table
        for i in range(1, n):
            for j, curr_assign in enumerate(all_assignments[i]):
                curr_internal = self._internal_cost(curr_assign)
                for k, prev_assign in enumerate(all_assignments[i - 1]):
                    transition = self._transition_cost(prev_assign, curr_assign)
                    total = dp[i - 1][k] + transition + curr_internal
                    if total < dp[i][j]:
                        dp[i][j] = total
                        back[i][j] = k

        # Step 4: Backtrack
        best_last = min(range(len(dp[-1])), key=lambda j: dp[-1][j])
        path: list[int] = [0] * n
        path[-1] = best_last
        for i in range(n - 2, -1, -1):
            path[i] = back[i + 1][path[i + 1]]

        # Step 5: Build TabNote results
        result: list[TabNote] = []
        for i, chord in enumerate(chords):
            assignment = all_assignments[i][path[i]]
            for note, (string, fret) in zip(chord.notes, assignment):
                result.append(
                    TabNote(
                        start_time=note.start_time,
                        end_time=note.end_time,
                        midi_pitch=note.midi_pitch,
                        velocity=note.velocity,
                        string=string,
                        fret=fret,
                    )
                )

        result.sort(key=lambda n: (n.start_time, n.string))
        return result

    def _group_chords(self, notes: list[NoteEvent]) -> list[ChordGroup]:
        """Group notes that start within chord_window of each other."""
        sorted_notes = sorted(notes, key=lambda n: n.start_time)
        groups: list[ChordGroup] = []
        current: list[NoteEvent] = [sorted_notes[0]]

        for note in sorted_notes[1:]:
            if note.start_time - current[0].start_time <= self.chord_window:
                current.append(note)
            else:
                groups.append(ChordGroup(start_time=current[0].start_time, notes=current))
                current = [note]

        groups.append(ChordGroup(start_time=current[0].start_time, notes=current))
        return groups

    def _generate_assignments(self, chord: ChordGroup) -> list[ChordAssignment]:
        """Generate all valid (string, fret) combinations for a chord."""
        # Get candidates per note
        per_note_candidates = []
        for note in chord.notes:
            cands = candidates_for_pitch(note.midi_pitch)
            if not cands:
                return []  # Note outside guitar range
            per_note_candidates.append(cands)

        # Enumerate all combinations
        valid: list[ChordAssignment] = []
        for combo in product(*per_note_candidates):
            combo_list = list(combo)
            # Check: no duplicate strings
            strings_used = [s for s, _ in combo_list]
            if len(strings_used) != len(set(strings_used)):
                continue

            # Check: fret span (excluding open strings)
            fretted = [f for _, f in combo_list if f > 0]
            if fretted:
                span = max(fretted) - min(fretted)
                if span > self.max_fret_span:
                    continue

            valid.append(combo_list)

            if len(valid) >= self.max_combos:
                break

        return valid

    def _fallback_assignment(self, chord: ChordGroup) -> ChordAssignment:
        """Best-effort assignment when no valid combo exists (e.g., >6 notes)."""
        used_strings: set[int] = set()
        assignment: ChordAssignment = []

        for note in chord.notes:
            candidates = candidates_for_pitch(note.midi_pitch)
            best = None
            for s, f in sorted(candidates, key=lambda x: x[1]):  # prefer lower frets
                if s not in used_strings:
                    best = (s, f)
                    used_strings.add(s)
                    break
            if best is None:
                # All strings taken or no candidates — force string 1 fret 0
                best = (1, max(0, note.midi_pitch - 64))
            assignment.append(best)

        return assignment

    def _internal_cost(self, assignment: ChordAssignment) -> float:
        """Cost of a single chord assignment: stretch + high fret penalty."""
        fretted = [f for _, f in assignment if f > 0]
        cost = 0.0

        if fretted:
            stretch = max(fretted) - min(fretted)
            cost += stretch * self.stretch_weight

            avg_fret = sum(f for _, f in assignment) / len(assignment)
            cost += avg_fret * self.high_fret_weight

        return cost

    def _transition_cost(
        self, prev: ChordAssignment, curr: ChordAssignment
    ) -> float:
        """Cost of transitioning between two chord assignments."""
        prev_pos = self._average_position(prev)
        curr_pos = self._average_position(curr)
        jump = abs(curr_pos - prev_pos)
        return jump * self.position_jump_weight

    @staticmethod
    def _average_position(assignment: ChordAssignment) -> float:
        """Average fret position (treating open strings as position 0)."""
        if not assignment:
            return 0.0
        return sum(f for _, f in assignment) / len(assignment)
