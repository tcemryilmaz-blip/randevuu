from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from app import clock

from .conftest import MONDAY_8AM, TZ, at, h, make_user


def book(client, user, slug, service, start, **extra):
    body = {"provider_slug": slug, "service_id": service, "start": start, "consent_health": True, **extra}
    return client.post("/bookings", json=body, headers=h(user))


# ------------------------------------------------------------------ arama

def test_search_returns_earliest_slots_first(client, world):
    book(client, world["ayse"], "dis", world["dis"]["service"], at(9))
    r = client.get("/search", params={"subcategory": "dis-hekimi", "district": "Kadıköy"}).json()
    assert [x["provider"]["slug"] for x in r["results"]] == ["dis"]
    assert r["results"][0]["slots"][0] == at(9, 30)          # 09:00 dolu, sıradaki 09:30
    assert r["results"][0]["strip"][0] is False and r["results"][0]["strip"][1] is True


def test_search_window_filters_slots(client, world):
    r = client.get("/search", params={"subcategory": "berber", "start": at(17), "end": at(18)}).json()
    assert r["results"][0]["slots"] == [at(17), at(17, 15), at(17, 30)]


def test_unpublished_provider_is_hidden_from_search_but_bookable_by_link(client, world, db):
    db.execute("update providers set publish_slots = false where slug = 'berber'")
    assert client.get("/search", params={"subcategory": "berber"}).json()["results"] == []
    assert book(client, world["ali"], "berber", world["berber"]["service"], at(10), source="link").status_code == 201


# ------------------------------------------------------------------ randevu

def test_booking_takes_deposit_and_returns_code(client, world, db):
    r = book(client, world["ali"], "dis", world["dis"]["service"], at(10))
    assert r.status_code == 201
    b = r.json()
    assert len(b["code"]) == 4 and b["deposit_paid"] == 20000 and b["end"] == at(10, 30)
    pay = db.execute("select kind, amount from payments").fetchall()
    assert [(p["kind"], p["amount"]) for p in pay] == [("deposit", 20000)]


def test_same_slot_cannot_be_booked_twice(client, world):
    assert book(client, world["ali"], "berber", world["berber"]["service"], at(10)).status_code == 201
    assert book(client, world["ayse"], "berber", world["berber"]["service"], at(10)).status_code == 409
    assert book(client, world["ayse"], "berber", world["berber"]["service"], at(10, 15)).status_code == 409  # çakışır


def test_concurrent_requests_for_one_slot_yield_one_booking(client, world, db):
    users = [make_user(db, f"u{i}") for i in range(8)]
    with ThreadPoolExecutor(8) as pool:
        codes = list(pool.map(lambda u: book(client, u, "berber", world["berber"]["service"], at(11)).status_code, users))
    assert sorted(codes) == [201] + [409] * 7
    assert db.execute("select count(*) as n from bookings").fetchone()["n"] == 1


def test_database_itself_rejects_overlap(world, db):
    """Uygulama atlanıp doğrudan yazılsa bile kısıt çift rezervasyonu engeller."""
    import psycopg
    import pytest
    sql = """insert into bookings (code, user_id, provider_id, resource_id, service_id, during, service_end, price)
             values (%s, %s, %s, %s, %s, tstzrange(%s, %s), %s, 0)"""
    w = world["berber"]
    db.execute(sql, ("AAAA", world["ali"], w["id"], w["resource"], w["service"], at(9), at(10), at(10)))
    with pytest.raises(psycopg.errors.ExclusionViolation):
        db.execute(sql, ("BBBB", world["ayse"], w["id"], w["resource"], w["service"], at(9, 30), at(10, 30), at(10, 30)))


def test_health_booking_requires_explicit_consent(client, world, db):
    r = book(client, world["ali"], "dis", world["dis"]["service"], at(10), consent_health=False)
    assert r.status_code == 422
    assert book(client, world["ali"], "berber", world["berber"]["service"], at(10), consent_health=False).status_code == 201
    book(client, world["ali"], "dis", world["dis"]["service"], at(10))
    assert db.execute("select consent_health_at from bookings where provider_id = %s", (world["dis"]["id"],)).fetchone()["consent_health_at"]


def test_rejects_past_off_grid_and_out_of_hours(client, world):
    s = world["berber"]["service"]
    assert book(client, world["ali"], "berber", s, at(7, 30)).status_code == 409      # geçmiş (şimdi 08:00)
    assert book(client, world["ali"], "berber", s, at(10, 7)).status_code == 409      # 15 dk ızgarasında değil
    assert book(client, world["ali"], "berber", s, at(18)).status_code == 409         # mesai dışı
    assert client.post("/bookings", json={}).status_code == 401


# ------------------------------------------------------------------ iptal ve bekleme listesi

def test_cancel_before_deadline_refunds_deposit_and_frees_slot(client, world, db):
    b = book(client, world["ali"], "dis", world["dis"]["service"], at(10, day=18)).json()   # 2 gün sonra
    r = client.post(f"/bookings/{b['id']}/cancel", headers=h(world["ali"])).json()
    assert r == {"cancelled": True, "deposit_refunded": True, "offered_to_waitlist": False}
    assert db.execute("select sum(amount) as s from payments").fetchone()["s"] == 0
    assert book(client, world["ayse"], "dis", world["dis"]["service"], at(10, day=18)).status_code == 201


def test_cancel_after_deadline_keeps_deposit(client, world, db):
    b = book(client, world["ali"], "dis", world["dis"]["service"], at(15)).json()           # 7 saat sonra < 24
    assert client.post(f"/bookings/{b['id']}/cancel", headers=h(world["ali"])).json()["deposit_refunded"] is False
    assert db.execute("select sum(amount) as s from payments").fetchone()["s"] == 20000


def test_only_owner_of_booking_can_cancel(client, world):
    b = book(client, world["ali"], "berber", world["berber"]["service"], at(10)).json()
    assert client.post(f"/bookings/{b['id']}/cancel", headers=h(world["ayse"])).status_code == 404


def test_cancellation_offers_slot_to_first_waiting_user(client, world, db):
    b = book(client, world["ali"], "berber", world["berber"]["service"], at(17)).json()
    w = client.post("/waitlist", headers=h(world["ayse"]), json={
        "provider_slug": "berber", "service_id": world["berber"]["service"], "start": at(16), "end": at(18)})
    assert w.status_code == 201 and w.json()["position"] == 1
    assert client.post(f"/bookings/{b['id']}/cancel", headers=h(world["ali"])).json()["offered_to_waitlist"] is True
    wallet = client.get("/me/wallet", headers=h(world["ayse"])).json()
    assert wallet["waitlist"][0]["status"] == "offered"


def test_wallet_lists_upcoming_bookings_and_tickets(client, world):
    book(client, world["ali"], "berber", world["berber"]["service"], at(10))
    e = client.post("/events", headers=h(world["ayse"]), json={
        "title": "Kahve turu", "start": at(11, day=21), "end": at(13, day=21), "place": "İskele", "capacity": 5, "price": 35000}).json()
    client.post(f"/events/{e['slug']}/tickets", headers=h(world["ali"]), json={"qty": 2})
    wallet = client.get("/me/wallet", headers=h(world["ali"])).json()
    assert len(wallet["bookings"]) == 1 and wallet["tickets"][0]["qty"] == 2 and wallet["tickets"][0]["amount"] == 70000


# ------------------------------------------------------------------ etkinlik

def test_private_event_is_invisible_without_invite(client, world):
    e = client.post("/events", headers=h(world["ali"]), json={
        "title": "Halı saha", "start": at(16, day=22), "end": at(18, day=22), "place": "Saha", "capacity": 20,
        "price": 0, "visibility": "private"}).json()
    assert e["invite_code"] and e["link"].startswith("randevuu.app/d/")
    assert client.get("/events").json()["events"] == []
    assert client.get(f"/events/{e['slug']}").status_code == 404
    assert client.get(f"/events/{e['slug']}", params={"invite": e["invite_code"]}).status_code == 200
    assert client.post(f"/events/{e['slug']}/tickets", headers=h(world["ayse"]), json={"qty": 1}).status_code == 404
    ok = client.post(f"/events/{e['slug']}/tickets", headers=h(world["ayse"]), json={"qty": 1, "invite": e["invite_code"]})
    assert ok.status_code == 201 and ok.json()["amount"] == 0


def test_concurrent_ticket_sales_never_exceed_capacity(client, world, db):
    e = client.post("/events", headers=h(world["ali"]), json={
        "title": "Atölye", "start": at(14, day=22), "end": at(17, day=22), "place": "Atölye", "capacity": 5, "price": 90000}).json()
    users = [make_user(db, f"b{i}") for i in range(12)]
    with ThreadPoolExecutor(12) as pool:
        codes = list(pool.map(lambda u: client.post(f"/events/{e['slug']}/tickets", headers=h(u), json={"qty": 1}).status_code, users))
    assert codes.count(201) == 5 and codes.count(409) == 7
    assert db.execute("select sold from events").fetchone()["sold"] == 5
    assert client.get("/events").json()["events"][0]["sold"] == 5


# ------------------------------------------------------------------ işletme paneli

def test_complete_collects_balance_and_creates_receipt_draft(client, world, db):
    b = book(client, world["ali"], "dis", world["dis"]["service"], at(10)).json()
    done = client.post(f"/biz/bookings/{b['id']}/complete", headers=h(world["owner"]), json={"method": "cash"}).json()
    assert done["status"] == "completed" and done["receipt"] == {"id": done["receipt"]["id"], "kind": "e-smm", "status": "draft"}
    assert db.execute("select sum(amount) as s from payments").fetchone()["s"] == 120000   # kapora + kalan = fiyat
    issued = client.post(f"/biz/receipts/{done['receipt']['id']}/issue", headers=h(world["owner"]))
    assert issued.json()["status"] == "issued"
    assert client.post(f"/biz/receipts/{done['receipt']['id']}/issue", headers=h(world["owner"])).status_code == 409

    fin = client.get("/biz/dis/finance", params={"month": "2026-11"}, headers=h(world["owner"])).json()
    assert (fin["completed"], fin["collected"], fin["receipts_issued"], fin["receipts_pending"]) == (1, 120000, 1, 0)


def test_agenda_shows_bookings_free_slots_and_first_visit(client, world):
    book(client, world["ali"], "dis", world["dis"]["service"], at(10))
    agenda = client.get("/biz/dis/agenda", params={"start": "2026-11-16", "days": 2}, headers=h(world["owner"])).json()
    monday = agenda["days"][0]
    assert monday["bookings"][0]["customer"] == "Ali" and monday["bookings"][0]["first_visit"] is True
    assert at(10) not in monday["free_slots"] and at(10, 30) in monday["free_slots"]
    assert len(agenda["days"]) == 2


def test_business_endpoints_are_owner_only(client, world):
    assert client.get("/biz/dis/agenda", params={"start": "2026-11-16"}, headers=h(world["ali"])).status_code == 403
    assert client.get("/biz/dis/finance", params={"month": "2026-11"}, headers=h(world["ali"])).status_code == 403
    b = book(client, world["ali"], "dis", world["dis"]["service"], at(10)).json()
    assert client.post(f"/biz/bookings/{b['id']}/complete", headers=h(world["ali"]), json={}).status_code == 404


def test_analytics_counts_occupancy_no_show_and_sources(client, world, monkeypatch):
    s = world["berber"]["service"]
    b1 = book(client, world["ali"], "berber", s, at(9), source="link").json()
    b2 = book(client, world["ayse"], "berber", s, at(10)).json()
    client.post(f"/biz/bookings/{b1['id']}/complete", headers=h(world["owner"]), json={})
    client.post(f"/biz/bookings/{b2['id']}/complete", headers=h(world["owner"]), json={"no_show": True})
    monkeypatch.setattr(clock, "now", lambda: MONDAY_8AM + timedelta(days=1))
    a = client.get("/biz/berber/analytics", params={"days": 7}, headers=h(world["owner"])).json()
    assert a["bookings"] == 2 and a["no_show_rate"] == 0.5 and a["sources"] == {"link": 1, "discover": 1}
    assert a["occupancy"] == round(30 / (7 * 9 * 60), 3)


# ------------------------------------------------------------------ öneri ve katalog

def test_suggest_maps_synonyms_to_service_area(client, world):
    first = lambda q: client.get("/suggest", params={"q": q}).json()["suggestions"][0]
    assert first("dişçi") == {"tur": "alan", "etiket": "Diş hekimi", "alt": "", "alan": "dis-hekimi"}
    assert first("DİŞÇİ")["alan"] == "dis-hekimi"          # büyük harf ve Türkçe karakter
    assert first("manikür")["alan"] == "guzellik"
    assert first("sakal")["alan"] == "berber"
    assert first("araba")["alan"] == "oto-yikama"


def test_suggest_prefers_exact_area_over_synonym_of_another(client, world):
    s = client.get("/suggest", params={"q": "kuaför"}).json()["suggestions"]
    assert s[0]["alan"] == "kuafor"                         # "oto kuaför" eş anlamlısı ikinci sırada kalır
    assert "oto-yikama" in [x["alan"] for x in s]


def test_suggest_finds_services_and_published_providers_only(client, world, db):
    db.execute("insert into services (provider_id, name, duration_min, price) values (%s, 'Kanal tedavisi', 60, 300000)", (world["dis"]["id"],))
    s = client.get("/suggest", params={"q": "kanal"}).json()["suggestions"]
    hizmet = next(x for x in s if x["tur"] == "hizmet")
    assert hizmet == {"tur": "hizmet", "etiket": "Kanal tedavisi", "alt": "Diş hekimi · 1 yer", "alan": "dis-hekimi", "hizmet": "Kanal tedavisi"}
    assert client.get("/suggest", params={"q": "berb"}).json()["suggestions"][0]["tur"] == "alan"
    assert any(x["tur"] == "isletme" and x["slug"] == "berber" for x in client.get("/suggest", params={"q": "berb"}).json()["suggestions"])
    db.execute("update providers set publish_slots = false where slug = 'berber'")
    assert not any(x["tur"] == "isletme" for x in client.get("/suggest", params={"q": "berb"}).json()["suggestions"])


def test_suggest_rejects_empty_query(client):
    assert client.get("/suggest", params={"q": ""}).status_code == 422


def test_categories_are_alphabetical_with_counts(client, world):
    cats = client.get("/categories").json()["categories"]
    names = [c["ad"] for c in cats]
    assert names[:3] == ["Berber", "Diş hekimi", "Güzellik merkezi"]
    assert {c["id"]: c["adet"] for c in cats}["dis-hekimi"] == 1


def test_search_by_service_name_uses_that_service(client, world, db):
    db.execute("insert into services (provider_id, name, duration_min, price) values (%s, 'Kanal tedavisi', 60, 300000)", (world["dis"]["id"],))
    r = client.get("/search", params={"subcategory": "dis-hekimi", "service": "kanal TEDAVİSİ"}).json()["results"]
    assert r[0]["service"]["name"] == "Kanal tedavisi" and r[0]["service"]["duration_min"] == 60
    assert client.get("/search", params={"subcategory": "dis-hekimi", "service": "Yok böyle"}).json()["results"] == []


def test_exact_service_beats_area_synonym(client, world, db):
    pid = db.execute(
        """insert into providers (owner_user_id, slug, name, title, category, subcategory, district)
           values (%s, 'nar', 'Nar Güzellik', 'Güzellik salonu', 'bakim', 'guzellik', 'Kadıköy') returning id""", (world["owner"],)
    ).fetchone()["id"]
    db.execute("insert into services (provider_id, name, duration_min, price) values (%s, 'Manikür', 45, 60000)", (pid,))
    s = client.get("/suggest", params={"q": "manikür"}).json()["suggestions"]
    assert [(x["tur"], x["etiket"]) for x in s[:2]] == [("hizmet", "Manikür"), ("alan", "Güzellik merkezi")]
