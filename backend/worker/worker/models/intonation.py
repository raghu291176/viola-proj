"""Tuning-system-aware intonation (ARCHITECTURE.md §4.4).

Elite string players do NOT play equal temperament. Melodic lines lean
**Pythagorean** (wider than ET), and leading tones / expressive notes are played
deliberately high. Judging against rigid ET would flag *correct* expressive
intonation as "out of tune" — the fastest way to lose a professional's trust.

This module gives the expected cents offset (from ET) for a scale degree under a
chosen system, so the per-note verdict measures deviation from the musically
correct target, not from a piano.
"""
from __future__ import annotations

# Cents offset from equal temperament for each semitone above the tonic.
# Pythagorean is derived from a chain of pure fifths; "expressive" exaggerates
# leading tones (as real players do). Diatonic degrees are the well-defined ones;
# chromatic degrees use sensible spellings.
SYSTEMS: dict[str, dict[int, float]] = {
    "equal": {i: 0.0 for i in range(12)},
    "pythagorean": {
        0: 0.0, 1: -9.8, 2: 3.9, 3: -5.9, 4: 7.8, 5: -2.0,
        6: 11.7, 7: 2.0, 8: -7.8, 9: 5.9, 10: -3.9, 11: 9.8,
    },
    "expressive": {  # Pythagorean, with leading tones/major thirds pushed higher
        0: 0.0, 1: -12.0, 2: 4.0, 3: -8.0, 4: 9.0, 5: -2.0,
        6: 12.0, 7: 2.0, 8: -10.0, 9: 6.0, 10: -6.0, 11: 14.0,
    },
}


def system_for(level: str | None) -> str:
    """Pedagogy: beginners target ET, advanced players target expressive."""
    return {"beginner": "equal", "intermediate": "pythagorean", "advanced": "expressive"}.get(
        (level or "intermediate").lower(), "pythagorean"
    )


def tonic_pc_from_fifths(fifths: int) -> int:
    """Major-key tonic pitch class from the MusicXML key signature (circle of fifths)."""
    return (fifths * 7) % 12


def expected_offset(system: str, semitone_from_tonic: int) -> float:
    return SYSTEMS.get(system, SYSTEMS["equal"]).get(semitone_from_tonic % 12, 0.0)
