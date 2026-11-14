"""Saat. Testler now() fonksiyonunu değiştirerek zamanı sabitler."""

from datetime import datetime, timezone


def now() -> datetime:
    return datetime.now(timezone.utc)
