"""Örnek veri: python -m scripts.seed

Kadıköy'de birkaç işletme, önümüzdeki 7 güne dağılmış randevular ve iki etkinlik
oluşturur. Veriler uydurmadır; yalnızca geliştirme ve tanıtım içindir.
"""

from __future__ import annotations

import random
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg
from psycopg.rows import dict_row

from app import slots
from app.db import DATABASE_URL

TZ = ZoneInfo("Europe/Istanbul")
DEMO_USER = "00000000-0000-4000-8000-000000000001"    # uygulamadaki örnek kullanıcı
DEMO_OWNER = "00000000-0000-4000-8000-000000000002"   # Dt. Selin Kaya (işletme sahibi)

PROVIDERS = [
    # slug, ad, unvan, kategori, alt kategori, adres, ön ödeme, belge, [(hizmet, dk, ara, fiyat)], doluluk
    ("selinkaya", "Dt. Selin Kaya", "Diş hekimi", "saglik", "dis-hekimi", "Moda Ağız ve Diş Kliniği, Moda Cad.",
     20000, "e-smm", [("Muayene", 30, 5, 120000), ("Diş taşı temizliği", 45, 5, 180000), ("Dolgu", 60, 10, 240000)], 0.7),
    ("burakyildiz", "Dt. Burak Yıldız", "Diş hekimi", "saglik", "dis-hekimi", "Bahariye Diş, Bahariye Cad.",
     0, "e-smm", [("Muayene", 30, 0, 100000), ("Dolgu", 60, 10, 220000)], 0.85),
    ("elifozturk", "Dt. Elif Öztürk", "Diş hekimi", "saglik", "dis-hekimi", "Fenerbahçe Dental, Bağdat Cad.",
     30000, "e-smm", [("Muayene", 30, 5, 140000)], 0.6),
    ("mertaydin", "Psk. Mert Aydın", "Psikolog", "saglik", "psikolog", "Caferağa Mah., Kadıköy",
     25000, "e-smm", [("Bireysel seans", 50, 10, 250000)], 0.75),
    ("berberhakan", "Berber Hakan", "Berber", "bakim", "berber", "Yeldeğirmeni, Karakolhane Cad.",
     0, "e-arsiv", [("Saç kesimi", 30, 0, 45000), ("Saç ve sakal", 45, 0, 65000)], 0.8),
    ("studyonefes", "Stüdyo Nefes", "Pilates stüdyosu", "spor", "pilates", "Moda, Şair Nefi Sok.",
     15000, "e-arsiv", [("Birebir pilates", 60, 0, 90000)], 0.65),
    ("salonmavi", "Salon Mavi", "Kuaför", "bakim", "kuafor", "Bahariye Cad., Kadıköy",
     10000, "e-arsiv", [("Fön", 30, 0, 40000), ("Saç kesimi", 45, 0, 80000), ("Boya", 120, 15, 250000)], 0.7),
    ("narguzellik", "Nar Güzellik", "Güzellik salonu", "bakim", "guzellik", "Moda, Leylek Sok.",
     15000, "e-arsiv", [("Manikür", 45, 5, 60000), ("Cilt bakımı", 60, 10, 150000)], 0.6),
    ("kopukoto", "Köpük Oto Yıkama", "Oto yıkama", "oto", "oto-yikama", "Hasanpaşa, Kurbağalıdere Cad.",
     0, "e-arsiv", [("Dış yıkama", 20, 5, 35000), ("İç ve dış yıkama", 45, 5, 60000)], 0.5),
    ("vetdenizari", "Vet. Deniz Arı", "Veteriner hekim", "evcil", "veteriner", "Acıbadem Cad., Kadıköy",
     0, "e-arsiv", [("Muayene", 30, 5, 80000), ("Aşı", 15, 5, 60000)], 0.55),
]

CUSTOMERS = ["Ahmet Y.", "Zeynep K.", "Deniz A.", "Can T.", "Elif S.", "Murat D.", "Seda P.", "Onur K.",
             "Aylin R.", "Kerem B.", "Derya M.", "Tolga E.", "Naz Ö.", "Selim G.", "İpek Y.", "Burcu T."]
CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def seed(url: str = DATABASE_URL, now: datetime | None = None) -> None:
    rnd = random.Random(7)
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(TZ).date()
    with psycopg.connect(url, row_factory=dict_row) as conn:
        conn.execute("truncate users, providers, events cascade")
        conn.execute("insert into users (id, phone, name) values (%s, '+905550000001', 'Emre Y.')", (DEMO_USER,))
        conn.execute("insert into users (id, phone, name) values (%s, '+905550000002', 'Selin Kaya')", (DEMO_OWNER,))
        customers = [
            conn.execute("insert into users (phone, name) values (%s, %s) returning id",
                         (f"+90555100{i:04d}", name)).fetchone()["id"]
            for i, name in enumerate(CUSTOMERS)
        ]

        for slug, name, title, cat, sub, address, deposit, receipt, services, fill in PROVIDERS:
            owner = DEMO_OWNER if slug == "selinkaya" else conn.execute(
                "insert into users (phone, name) values (%s, %s) returning id", (f"+90555200{rnd.randint(0, 9999):04d}", name)
            ).fetchone()["id"]
            pid = conn.execute(
                """insert into providers (owner_user_id, slug, name, title, category, subcategory, district, address,
                                          deposit_amount, receipt_kind)
                   values (%s, %s, %s, %s, %s, %s, 'Kadıköy', %s, %s, %s) returning id""",
                (owner, slug, name, title, cat, sub, address, deposit, receipt),
            ).fetchone()["id"]
            rid = conn.execute("insert into resources (provider_id, name) values (%s, %s) returning id", (pid, name)).fetchone()["id"]
            for weekday in range(6):  # Pzt–Cmt; öğle arası 12:30–13:30
                last = time(15, 0) if weekday == 5 else time(19, 30)
                conn.execute("insert into working_hours (resource_id, weekday, start_time, end_time) values (%s, %s, '09:00', '12:30')", (rid, weekday))
                conn.execute("insert into working_hours (resource_id, weekday, start_time, end_time) values (%s, %s, '13:30', %s)", (rid, weekday, last))
            svc_rows = [
                conn.execute(
                    "insert into services (provider_id, name, duration_min, buffer_min, price) values (%s, %s, %s, %s, %s) returning *",
                    (pid, s[0], s[1], s[2], s[3]),
                ).fetchone()
                for s in services
            ]

            # Önümüzdeki 7 günü "fill" oranında rastgele doldur (slot motorunu kullanarak, çakışmasız).
            for offset in range(-1, 7):
                day = today + timedelta(days=offset)
                hours = conn.execute(
                    "select start_time, end_time from working_hours where resource_id = %s and weekday = %s", (rid, day.weekday())
                ).fetchall()
                work = [(datetime.combine(day, h["start_time"], tzinfo=TZ), datetime.combine(day, h["end_time"], tzinfo=TZ)) for h in hours]
                busy: list[slots.Interval] = []
                while True:
                    svc = rnd.choice(svc_rows)
                    starts = slots.free_starts(work, busy, svc["duration_min"], svc["buffer_min"], 30)
                    open_min = sum((w[1] - w[0]).total_seconds() / 60 for w in work) or 1
                    used = sum((b[1] - b[0]).total_seconds() / 60 for b in busy)
                    if not starts or used / open_min >= fill:
                        break
                    start = rnd.choice(starts)
                    end = start + timedelta(minutes=svc["duration_min"])
                    occupied = end + timedelta(minutes=svc["buffer_min"])
                    busy.append((start, occupied))
                    past = end < now
                    conn.execute(
                        """insert into bookings (code, user_id, provider_id, resource_id, service_id, during, service_end,
                                                 status, source, price, deposit_paid, consent_health_at)
                           values (%s, %s, %s, %s, %s, tstzrange(%s, %s), %s, %s, %s, %s, %s, %s)
                           on conflict do nothing""",
                        ("".join(rnd.choice(CODE) for _ in range(4)), rnd.choice(customers), pid, rid, svc["id"], start, occupied, end,
                         "completed" if past else "confirmed", rnd.choice(["link", "link", "link", "discover", "manual"]),
                         svc["price"], deposit, now if cat == "saglik" else None),
                    )

        # Geçmiş randevular için tahsilat ve belge taslağı
        for b in conn.execute(
            "select b.id, b.price, b.deposit_paid, p.receipt_kind from bookings b join providers p on p.id = b.provider_id where b.status = 'completed'"
        ).fetchall():
            if b["deposit_paid"]:
                conn.execute("insert into payments (booking_id, kind, method, amount) values (%s, 'deposit', 'online', %s)", (b["id"], b["deposit_paid"]))
            conn.execute("insert into payments (booking_id, kind, method, amount) values (%s, 'balance', 'card_onsite', %s)", (b["id"], b["price"] - b["deposit_paid"]))
            conn.execute("insert into receipts (booking_id, kind, amount, status) values (%s, %s, %s, %s)",
                         (b["id"], b["receipt_kind"], b["price"], rnd.choice(["issued", "issued", "draft"])))

        # Etkinlikler: biri açık, biri özel
        saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
        organizer = conn.execute("insert into users (phone, name) values ('+905553000001', 'Ayşe D.') returning id").fetchone()["id"]
        conn.execute(
            """insert into events (organizer_user_id, slug, title, description, category, starts_at, ends_at, place, district,
                                   capacity, sold, price, visibility)
               values (%s, 'kadikoy-kahve-turu', 'Kadıköy tarihi kahve turu',
                       'Moda''dan Yeldeğirmeni''ne üç tarihi kahvehane, kısa hikâyeler ve Türk kahvesi tadımı. Rahat tempoda, yaklaşık 3 km yürüyüş.',
                       'gezi', %s, %s, 'Kadıköy İskelesi önü', 'Kadıköy', 12, 8, 35000, 'public')""",
            (organizer, datetime.combine(saturday, time(11, 0), tzinfo=TZ), datetime.combine(saturday, time(13, 30), tzinfo=TZ)),
        )
        conn.execute(
            """insert into events (organizer_user_id, slug, title, description, category, starts_at, ends_at, place, district,
                                   capacity, sold, price, visibility)
               values (%s, 'seramik-atolyesi', 'Başlangıç seramik atölyesi', 'Çarkta ilk kâse. Malzeme ve pişirim dahil.',
                       'atolye', %s, %s, 'Yeldeğirmeni Atölye', 'Kadıköy', 8, 3, 90000, 'public')""",
            (organizer, datetime.combine(saturday + timedelta(days=1), time(14, 0), tzinfo=TZ),
             datetime.combine(saturday + timedelta(days=1), time(17, 0), tzinfo=TZ)),
        )
        conn.execute(
            """insert into events (organizer_user_id, slug, title, category, starts_at, ends_at, place, district,
                                   capacity, sold, price, visibility, invite_code)
               values (%s, 'ofis-hali-saha', 'Ofis halı saha turnuvası', 'spor', %s, %s, 'Fikirtepe Halı Saha', 'Kadıköy',
                       20, 11, 0, 'private', 'HALISAHA-7K4Q')""",
            (DEMO_OWNER, datetime.combine(saturday + timedelta(days=1), time(16, 0), tzinfo=TZ),
             datetime.combine(saturday + timedelta(days=1), time(18, 0), tzinfo=TZ)),
        )
    print("Örnek veri yüklendi. Örnek kullanıcı:", DEMO_USER, "· işletme sahibi:", DEMO_OWNER)


if __name__ == "__main__":
    seed()
