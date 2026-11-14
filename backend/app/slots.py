"""Slot motoru: saf fonksiyonlar, veritabanı bilmez.

Bir kaynağın (uzman, koltuk, oda) çalışma aralıkları ile dolu aralıklarından
boş başlangıç saatlerini ve "gün şeridi"ni üretir. Aralıklar [başlangıç, bitiş).
"""

from __future__ import annotations

from datetime import datetime, timedelta

Interval = tuple[datetime, datetime]


def merge(intervals: list[Interval]) -> list[Interval]:
    """Çakışan ya da bitişik aralıkları birleştirir."""
    out: list[Interval] = []
    for start, end in sorted(i for i in intervals if i[1] > i[0]):
        if out and start <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], end))
        else:
            out.append((start, end))
    return out


def subtract(base: list[Interval], busy: list[Interval]) -> list[Interval]:
    """base aralıklarından busy aralıklarını çıkarır."""
    busy = merge(busy)
    out: list[Interval] = []
    for start, end in merge(base):
        cursor = start
        for b_start, b_end in busy:
            if b_end <= cursor or b_start >= end:
                continue
            if b_start > cursor:
                out.append((cursor, b_start))
            cursor = max(cursor, b_end)
            if cursor >= end:
                break
        if cursor < end:
            out.append((cursor, end))
    return out


def _align_up(moment: datetime, step_min: int) -> datetime:
    """moment'i saat başına göre step_min'in katına yukarı yuvarlar."""
    floor = moment.replace(second=0, microsecond=0)
    floor -= timedelta(minutes=floor.minute % step_min)
    return floor if floor == moment else floor + timedelta(minutes=step_min)


def free_starts(
    work: list[Interval],
    busy: list[Interval],
    duration_min: int,
    buffer_min: int = 0,
    step_min: int = 15,
    not_before: datetime | None = None,
) -> list[datetime]:
    """Randevunun başlayabileceği saatler.

    Hizmet süresi çalışma saatinin içinde kalmalı; hizmet + ara süresi hiçbir
    dolu aralıkla çakışmamalı. Ara (buffer) mesai bitimine taşabilir.
    """
    duration = timedelta(minutes=duration_min)
    occupied = timedelta(minutes=duration_min + buffer_min)
    busy = merge(busy)
    starts: list[datetime] = []
    for w_start, w_end in merge(work):
        cursor = _align_up(max(w_start, not_before) if not_before else w_start, step_min)
        while cursor + duration <= w_end:
            clash = next((b for b in busy if b[0] < cursor + occupied and b[1] > cursor), None)
            if clash is None:
                starts.append(cursor)
                cursor += timedelta(minutes=step_min)
            else:
                cursor = _align_up(clash[1], step_min)
    return starts


def day_strip(
    work: list[Interval],
    busy: list[Interval],
    strip_start: datetime,
    segments: int = 20,
    segment_min: int = 30,
) -> list[bool]:
    """Gün şeridi: her dilim için True = boş, False = dolu ya da kapalı.

    Varsayılan 09:00'dan başlayan 20 yarım saatlik dilimdir (09–19).
    """
    free = subtract(work, busy)
    strip: list[bool] = []
    for i in range(segments):
        seg_start = strip_start + timedelta(minutes=i * segment_min)
        seg_end = seg_start + timedelta(minutes=segment_min)
        strip.append(any(f[0] <= seg_start and f[1] >= seg_end for f in free))
    return strip
