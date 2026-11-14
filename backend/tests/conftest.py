"""Test düzeni: gerçek Postgres üzerinde çalışır (kısıtlar veritabanında olduğu için).

TEST_DATABASE_URL boş bir veritabanını göstermelidir; her oturumda şema baştan kurulur.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg
import pytest

TEST_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres@localhost:5432/randevuu_test")
os.environ["DATABASE_URL"] = TEST_URL

from fastapi.testclient import TestClient  # noqa: E402

from app import clock  # noqa: E402
from app.main import app  # noqa: E402
from scripts.migrate import migrate  # noqa: E402

TZ = ZoneInfo("Europe/Istanbul")
MONDAY_8AM = datetime(2026, 11, 16, 8, 0, tzinfo=TZ)   # testlerde "şimdi"


@pytest.fixture(scope="session", autouse=True)
def schema():
    with psycopg.connect(TEST_URL, autocommit=True) as conn:
        conn.execute("drop schema public cascade; create schema public")
    migrate(TEST_URL)


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    with psycopg.connect(TEST_URL, autocommit=True) as conn:
        conn.execute("truncate users, providers, events cascade")
    monkeypatch.setattr(clock, "now", lambda: MONDAY_8AM)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    with psycopg.connect(TEST_URL, autocommit=True, row_factory=psycopg.rows.dict_row) as conn:
        yield conn


def make_user(db, name="Test", phone=None):
    phone = phone or f"+90{abs(hash((name, os.urandom(4)))) % 10**10:010d}"
    return str(db.execute("insert into users (phone, name) values (%s, %s) returning id", (phone, name)).fetchone()["id"])


@pytest.fixture
def world(db):
    """Bir diş hekimi (kaporalı, sağlık), bir berber ve iki kullanıcı."""
    owner = make_user(db, "Selin Kaya")
    w = {"owner": owner, "ali": make_user(db, "Ali"), "ayse": make_user(db, "Ayşe")}
    for slug, cat, sub, deposit, kind in (("dis", "saglik", "dis-hekimi", 20000, "e-smm"), ("berber", "bakim", "berber", 0, "e-arsiv")):
        pid = db.execute(
            """insert into providers (owner_user_id, slug, name, title, category, subcategory, district, deposit_amount, receipt_kind)
               values (%s, %s, %s, '', %s, %s, 'Kadıköy', %s, %s) returning id""",
            (owner, slug, slug.title(), cat, sub, deposit, kind),
        ).fetchone()["id"]
        rid = db.execute("insert into resources (provider_id, name) values (%s, 'Koltuk 1') returning id", (pid,)).fetchone()["id"]
        for weekday in range(7):
            db.execute("insert into working_hours (resource_id, weekday, start_time, end_time) values (%s, %s, '09:00', '18:00')", (rid, weekday))
        sid = db.execute(
            "insert into services (provider_id, name, duration_min, buffer_min, price) values (%s, 'Muayene', 30, 0, 120000) returning id", (pid,)
        ).fetchone()["id"]
        w[slug] = {"id": str(pid), "resource": str(rid), "service": str(sid)}
    return w


def at(hour, minute=0, day=16):
    return datetime(2026, 11, day, hour, minute, tzinfo=TZ).isoformat()


def h(user):
    return {"X-User-Id": user}
