"""
Viterbi-style DP solver for assigning (string, fret) to detected notes.

Algorithm:
1. Group simultaneous notes into chords (within a time window).
2. Generate all valid (string, fret) assignments per chord.
3. DP across chord sequence, minimizing cost:
   - Position jump between consecutive chords (strong stickiness)
   - Internal fret stretch within a chord
   - Deviation from target zone (if specified)
   - Slight penalty for high frets (prefer lower positions)
4. Backtrack for optimal assignment path.
"""

import logging
from itertools import product
from dataclasses import dataclass

from app.config import settings
from app.models.note_event import NoteEvent, TabNote
from app.models.guitar import candidates_for_pitch, NUM_STRINGS

logger = logging.getLogger(__name__)


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
        target_fret: int | None = None,
    ):
        self.chord_window = chord_window_ms / 1000.0
        self.max_fret_span = max_fret_span
        self.position_jump_weight = position_jump_weight
        self.stretch_weight = stretch_weight
        self.high_fret_weight = high_fret_weight
        self.max_combos = max_combos
        self.target_fret = target_fret  # user-specified fret zone hint

    def solve(self, notes: list[NoteEvent]) -> list[TabNote]:
        if not notes:
            return []

        # Step 1: Group into chords
        chords = self._group_chords(notes)
        logger.info(
            "Solver: %d notes -> %d chord groups (window=%.0fms)",
            len(notes), len(chords), self.chord_window * 1000,
        )

        # Step 2: Generate valid assignments per chord
        all_assignments: list[list[ChordAssignment]] = []
        for chord in chords:
            assignments = self._generate_assignments(chord)
            if not assignments:
                assignments = [self._fallback_assignment(chord)]
            all_assignments.append(assignments)

        # Step 3: Viterbi DP
        n = len(chords)
        dp: list[list[float]] = [[INF] * len(all_assignments[i]) for i in range(n)]
        back: list[list[int]] = [[-1] * len(all_assignments[i]) for i in range(n)]

        # Initialize first chord — include zone bias
        for j, assign in enumerate(all_assignments[0]):
            dp[0][j] = self._internal_cost(assign) + self._zone_cost(assign)

        # Fill DP table
        for i in range(1, n):
            for j, curr_assign in enumerate(all_assignments[i]):
                curr_internal = self._internal_cost(curr_assign)
                curr_zone = self._zone_cost(curr_assign)
                for k, prev_assign in enumerate(all_assignments[i - 1]):
                    transition = self._transition_cost(prev_assign, curr_assign)
                    total = dp[i - 1][k] + transition + curr_internal + curr_zone
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

        # Log the position zone used
        if result:
            frets = [n.fret for n in result if n.fret > 0]
            if frets:
                logger.info(
                    "Solver result: fret range %d-%d (avg %.1f), target=%s",
                    min(frets), max(frets), sum(frets) / len(frets),
                    self.target_fret if self.target_fret is not None else "auto",
                )

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
        per_note_candidates = []
        for note in chord.notes:
            cands = candidates_for_pitch(note.midi_pitch)
            if not cands:
                return []
            per_note_candidates.append(cands)

        # Enumerate all combinations
        valid: list[ChordAssignment] = []
        for combo in product(*per_note_candidates):
            combo_list = list(combo)
            # No duplicate strings
            strings_used = [s for s, _ in combo_list]
            if len(strings_used) != len(set(strings_used)):
                continue

            # Fret span check (excluding open strings)
            fretted = [f for _, f in combo_list if f > 0]
            if fretted:
                span = max(fretted) - min(fretted)
                if span > self.max_fret_span:
                    continue

            valid.append(combo_list)

            if len(valid) >= self.max_combos:
                break

        # Sort by zone proximity so best candidates are kept when capped
        if self.target_fret is not None:
            valid.sort(key=lambda a: self._zone_cost(a))

        return valid

    def _fallback_assignment(self, chord: ChordGroup) -> ChordAssignment:
        """Best-effort assignment when no valid combo exists (e.g., >6 notes)."""
        used_strings: set[int] = set()
        assignment: ChordAssignment = []

        for note in chord.notes:
            candidates = candidates_for_pitch(note.midi_pitch)
            # Sort by proximity to target zone if specified
            if self.target_fret is not None:
                candidates.sort(key=lambda sf: abs(sf[1] - self.target_fret))
            else:
                candidates.sort(key=lambda sf: sf[1])  # prefer lower frets

            best = None
            for s, f in candidates:
                if s not in used_strings:
                    best = (s, f)
                    used_strings.add(s)
                    break
            if best is None:
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

    def _zone_cost(self, assignment: ChordAssignment) -> float:
        """Cost for deviating from the user's target fret zone."""
        if self.target_fret is None:
            return 0.0

        # Penalize distance from target for each fretted note
        cost = 0.0
        zone_weight = 2.0  # strong bias toward the target zone
        for _, fret in assignment:
            if fret > 0:
                cost += abs(fret - self.target_fret) * zone_weight
            else:
                # Open string: moderate penalty if target zone is high
                cost += self.target_fret * 0.3
        return cost

    def _transition_cost(
        self, prev: ChordAssignment, curr: ChordAssignment
    ) -> float:
        """Cost of transitioning between two chord assignments.

        Uses squared jump for stronger position stickiness —
        small jumps are cheap, big jumps are very expensive.
        """
        prev_pos = self._fret_position(prev)
        curr_pos = self._fret_position(curr)
        jump = abs(curr_pos - prev_pos)
        # Squared cost: 1-fret jump = 1, 3-fret jump = 9, 5-fret jump = 25
        return (jump ** 2) * self.position_jump_weight

    @staticmethod
    def _fret_position(assignment: ChordAssignment) -> float:
        """Average fret position of fretted notes only (ignores open strings).
        Falls back to 0 if all open strings."""
        fretted = [f for _, f in assignment if f > 0]
        if not fretted:
            return 0.0
        return sum(fretted) / len(fretted)
