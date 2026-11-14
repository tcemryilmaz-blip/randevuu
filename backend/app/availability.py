"""Müsaitlik: veritabanındaki takvimi slot motoruna bağlar."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import psycopg

from . import slots

STRIP_START = time(9, 0)   # gün şeridi 09:00'da başlar
STRIP_SEGMENTS = 20        # 20 x 30 dk = 09–19
STEP_MIN = 15


def day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time(0, 0), tzinfo=tz)
    return start, start + timedelta(days=1)


def work_and_busy(
    conn: psycopg.Connection, resource_id, day: date, tz: ZoneInfo
) -> tuple[list[slots.Interval], list[slots.Interval]]:
    """Bir kaynağın o günkü çalışma ve dolu aralıkları."""
    day_start, day_end = day_bounds(day, tz)
    hours = conn.execute(
        "select start_time, end_time from working_hours where resource_id = %s and weekday = %s",
        (resource_id, day.weekday()),
    ).fetchall()
    work = [
        (datetime.combine(day, h["start_time"], tzinfo=tz), datetime.combine(day, h["end_time"], tzinfo=tz))
        for h in hours
    ]
    busy_rows = conn.execute(
        """
        select lower(during) as s, upper(during) as e from bookings
         where resource_id = %(r)s and status in ('confirmed', 'completed')
           and during && tstzrange(%(a)s, %(b)s)
        union all
        select lower(during), upper(during) from time_off
         where resource_id = %(r)s and during && tstzrange(%(a)s, %(b)s)
        """,
        {"r": resource_id, "a": day_start, "b": day_end},
    ).fetchall()
    busy = [(r["s"], r["e"]) for r in busy_rows]
    return work, busy


def free_starts_for_day(
    conn: psycopg.Connection,
    resource_id,
    service: dict,
    day: date,
    tz: ZoneInfo,
    now: datetime,
    window: tuple[datetime, datetime] | None = None,
) -> tuple[list[datetime], list[bool]]:
    """(boş başlangıç saatleri, gün şeridi). window verilirse saatler o aralığa süzülür."""
    work, busy = work_and_busy(conn, resource_id, day, tz)
    starts = slots.free_starts(
        work, busy, service["duration_min"], service["buffer_min"], STEP_MIN, not_before=now
    )
    if window:
        starts = [s for s in starts if window[0] <= s < window[1]]
    # Geçmişte kalan dilimler şeritte boş görünmesin.
    past = [(day_bounds(day, tz)[0], now)] if now > day_bounds(day, tz)[0] else []
    strip = slots.day_strip(
        work, busy + past, datetime.combine(day, STRIP_START, tzinfo=tz), STRIP_SEGMENTS
    )
    return starts, strip
