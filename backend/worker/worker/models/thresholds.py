"""Level-based judging thresholds (ARCHITECTURE.md §4.4).

"Within the applicable threshold" is a policy keyed to the user's level, not a
hardcoded constant. A beginner passes at ±30 cents; an advanced Soundcheck
demands ±10-15 cents.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Thresholds:
    intonation_cents: float   # max |cents| to count as in tune
    timing_beat_frac: float   # max onset error as a fraction of one beat
    duration_frac: float      # max duration error as a fraction of notated value


_LEVELS: dict[str, Thresholds] = {
    "beginner":     Thresholds(intonation_cents=30, timing_beat_frac=0.20, duration_frac=0.35),
    "intermediate": Thresholds(intonation_cents=20, timing_beat_frac=0.17, duration_frac=0.25),
    "advanced":     Thresholds(intonation_cents=13, timing_beat_frac=0.15, duration_frac=0.20),
}


def policy(level: str | None) -> Thresholds:
    return _LEVELS.get((level or "intermediate").lower(), _LEVELS["intermediate"])
