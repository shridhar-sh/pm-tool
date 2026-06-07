"""
Working-day arithmetic.

A working day is Mon-Fri AND not a non-working holiday for the agency.
A holiday with `isWorking=True` is treated as a normal working day
(e.g. weekend shoot days that override the calendar).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Mapping


def parse_date(s: str) -> date:
    """YYYY-MM-DD → date. Raises ValueError on bad input."""
    return date.fromisoformat(s)


def build_calendar(holidays: Iterable[Mapping]) -> dict[str, bool]:
    """
    Build a {YYYY-MM-DD: isWorking} index from the holidays collection.
    Defaults to True (working) when the date is missing.
    """
    out: dict[str, bool] = {}
    for h in holidays:
        d = h.get("date")
        if not d:
            continue
        # If isWorking is True, treat as a working day override.
        out[d] = bool(h.get("isWorking", False))
    return out


def is_weekend(d: date) -> bool:
    return d.weekday() >= 5      # Sat=5, Sun=6


def is_working_day(d: date, cal: Mapping[str, bool]) -> bool:
    """
    Holiday override wins: if the calendar marks the day, that flag rules.
    Otherwise it's a working day iff it's not a weekend.
    """
    key = d.isoformat()
    if key in cal:
        return cal[key]
    return not is_weekend(d)


def next_working_day(d: date, cal: Mapping[str, bool]) -> date:
    """Returns d itself if it's already a working day, else the next one."""
    cur = d
    # Bound the loop so a broken calendar can't spin forever.
    for _ in range(366 * 5):
        if is_working_day(cur, cal):
            return cur
        cur += timedelta(days=1)
    raise RuntimeError("No working day found within 5 years")


def add_working_days(start: date, n_days: int, cal: Mapping[str, bool]) -> date:
    """
    Advance `n_days` working days from `start`.

    Convention: if n_days == 1, the result is `start` itself if it's a
    working day, i.e. the first working day at or after `start`. Each
    additional `n_days` steps to the NEXT working day. This matches the
    usual Gantt "task takes N days starting today" mental model.
    """
    if n_days < 1:
        n_days = 1
    cur = next_working_day(start, cal)
    remaining = n_days - 1
    while remaining > 0:
        cur += timedelta(days=1)
        if is_working_day(cur, cal):
            remaining -= 1
    return cur


def working_days_between(start: date, end: date, cal: Mapping[str, bool]) -> int:
    """Inclusive count of working days from start..end."""
    if end < start:
        return 0
    cur = start
    count = 0
    while cur <= end:
        if is_working_day(cur, cal):
            count += 1
        cur += timedelta(days=1)
    return count
