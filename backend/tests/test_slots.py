from datetime import datetime, timedelta, timezone

from app import slots


def t(hour, minute=0):
    return datetime(2026, 11, 16, hour, minute, tzinfo=timezone.utc)


WORK = [(t(9), t(12)), (t(13), t(18))]


def test_subtract_splits_interval():
    assert slots.subtract([(t(9), t(12))], [(t(10), t(11))]) == [(t(9), t(10)), (t(11), t(12))]


def test_merge_joins_overlaps():
    assert slots.merge([(t(9), t(10)), (t(10), t(11)), (t(13), t(14))]) == [(t(9), t(11)), (t(13), t(14))]


def test_free_starts_respects_working_hours():
    starts = slots.free_starts(WORK, [], 30, step_min=30)
    assert starts[0] == t(9)
    assert t(11, 30) in starts          # 11:30–12:00 sığar
    assert t(12) not in starts          # öğle arası
    assert starts[-1] == t(17, 30)      # hizmet 18:00'de biter


def test_service_must_fit_before_closing():
    assert t(11, 30) not in slots.free_starts(WORK, [], 45, step_min=15)
    assert t(11, 15) in slots.free_starts(WORK, [], 45, step_min=15)


def test_busy_blocks_overlapping_starts():
    starts = slots.free_starts(WORK, [(t(10), t(10, 30))], 30, step_min=15)
    assert t(9, 30) in starts
    assert t(9, 45) not in starts       # 10:15'e taşar
    assert t(10, 15) not in starts
    assert t(10, 30) in starts


def test_buffer_keeps_gap_before_next_booking():
    busy = [(t(10), t(10, 30))]
    assert t(9, 30) in slots.free_starts(WORK, busy, 30, buffer_min=0, step_min=15)
    assert t(9, 30) not in slots.free_starts(WORK, busy, 30, buffer_min=10, step_min=15)
    assert t(9, 15) in slots.free_starts(WORK, busy, 30, buffer_min=10, step_min=15)


def test_buffer_may_spill_past_closing():
    assert t(17, 30) in slots.free_starts(WORK, [], 30, buffer_min=15, step_min=30)


def test_not_before_aligns_up_to_step():
    starts = slots.free_starts(WORK, [], 30, step_min=15, not_before=t(9, 7))
    assert starts[0] == t(9, 15)


def test_day_strip_marks_free_and_busy_segments():
    strip = slots.day_strip(WORK, [(t(9), t(10))], t(9))
    assert len(strip) == 20
    assert strip[0] is False and strip[1] is False      # 09:00–10:00 dolu
    assert strip[2] is True                             # 10:00–10:30 boş
    assert strip[6] is False and strip[7] is False      # 12:00–13:00 kapalı
    assert strip[8] is True


def test_partially_busy_segment_is_not_free():
    strip = slots.day_strip(WORK, [(t(9, 15), t(9, 20))], t(9))
    assert strip[0] is False
    assert t(9) + timedelta(minutes=30) and strip[1] is True
