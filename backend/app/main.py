"""randevuu API.

Kimlik doğrulama şimdilik geliştirme amaçlıdır: istek X-User-Id başlığıyla gelir.
Canlıya çıkmadan önce telefonla tek kullanımlık kod (OTP) + oturum belirteci ile değişecek.
"""

from __future__ import annotations

import json
import re
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import availability, clock, oneri
from .db import close_pool, tx
from .payments import gateway

HEALTH_CATEGORIES = {"saglik"}          # açık rıza isteyen kategoriler
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # karışan harfler yok (I, O, 0, 1)
ACTIVE = ("confirmed", "completed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    close_pool()


app = FastAPI(title="randevuu API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------- yardımcılar

def vuu_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))


def slugify(text: str) -> str:
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    slug = re.sub(r"[^a-z0-9]+", "-", text.translate(table).lower()).strip("-")
    return slug or "etkinlik"


def current_user(x_user_id: str | None = Header(default=None)) -> UUID:
    if not x_user_id:
        raise HTTPException(401, "Giriş gerekli")
    try:
        return UUID(x_user_id)
    except ValueError:
        raise HTTPException(401, "Geçersiz kullanıcı")


def get_provider(conn: psycopg.Connection, slug: str) -> dict:
    row = conn.execute("select * from providers where slug = %s", (slug,)).fetchone()
    if not row:
        raise HTTPException(404, "İşletme bulunamadı")
    return row


def own_provider(conn: psycopg.Connection, slug: str, user_id: UUID) -> dict:
    provider = get_provider(conn, slug)
    if provider["owner_user_id"] != user_id:
        raise HTTPException(403, "Bu işletmenin sahibi değilsin")
    return provider


def provider_public(p: dict) -> dict:
    keys = ("slug", "name", "title", "category", "subcategory", "district", "address", "lat", "lng",
            "deposit_amount", "cancel_hours")
    out = {k: p[k] for k in keys}
    out["needs_health_consent"] = p["category"] in HEALTH_CATEGORIES
    return out


def service_public(s: dict) -> dict:
    return {"id": str(s["id"]), "name": s["name"], "duration_min": s["duration_min"], "price": s["price"]}


def booking_public(b: dict) -> dict:
    return {
        "id": str(b["id"]), "code": b["code"], "status": b["status"],
        "start": b["s"].isoformat(), "end": b["service_end"].isoformat(),
        "price": b["price"], "deposit_paid": b["deposit_paid"], "deposit_refunded": b["deposit_refunded"],
        "provider": {"slug": b["slug"], "name": b["provider_name"], "address": b["address"]},
        "service": b["service_name"],
    }


BOOKING_SELECT = """
    select b.*, lower(b.during) as s, p.slug, p.name as provider_name, p.address, s.name as service_name
      from bookings b join providers p on p.id = b.provider_id join services s on s.id = b.service_id
"""


# ---------------------------------------------------------------- genel

@app.get("/health")
def health():
    with tx() as conn:
        conn.execute("select 1")
    return {"ok": True}


APP_CONFIG = Path(__file__).resolve().parent.parent / "app_config.json"


@app.get("/app-config")
def app_config():
    """Uygulamanın uzaktan ayarı: metin, renk ve maskot sözleri.

    backend/app_config.json dosyasındaki anahtarlar uygulamadaki varsayılanların üzerine
    yazılır (mobile/src/config). Dosya her istekte okunur; değişiklik için yeniden başlatma gerekmez.
    """
    try:
        return json.loads(APP_CONFIG.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


# ---------------------------------------------------------------- katalog ve öneri

@app.get("/categories")
def categories():
    """Hizmet alanları, alfabetik. Yanında keşifte görünen işletme sayısı."""
    with tx() as conn:
        adet = {r["subcategory"]: r["n"] for r in conn.execute(
            "select subcategory, count(*) as n from providers where publish_slots group by subcategory"
        ).fetchall()}
    alanlar = [{"id": a["id"], "ad": a["ad"], "adet": adet.get(a["id"], 0)} for a in oneri.katalog()]
    alanlar.sort(key=lambda a: oneri.katla(a["ad"]))
    return {"categories": alanlar}


@app.get("/suggest")
def suggest(q: str = Query(min_length=1, max_length=80)):
    """Yazarken öneri: hizmet alanı (eş anlamlılarıyla), hizmet adı ve işletme adı.

    Yalnızca boş saatlerini yayınlayan işletmeler önerilir.
    """
    with tx() as conn:
        hizmetler = conn.execute(
            """select s.name, p.subcategory from services s join providers p on p.id = s.provider_id
                where s.active and p.publish_slots"""
        ).fetchall()
        isletmeler = conn.execute(
            "select slug, name, title, subcategory, district from providers where publish_slots"
        ).fetchall()
    return {"q": q, "suggestions": oneri.oner(q, hizmetler, isletmeler)}


# ---------------------------------------------------------------- arama

@app.get("/search")
def search(
    subcategory: str,
    district: str | None = None,
    service: str | None = Query(default=None, description="Hizmet adı; verilirse yalnızca bu hizmeti sunanlar"),
    start: datetime | None = Query(default=None, description="Aralığın başı; boşsa şimdi"),
    end: datetime | None = Query(default=None, description="Aralığın sonu; boşsa başlangıç + 24 saat"),
):
    """O aralıkta gerçekten boş anı olan işletmeler, en erken ana göre sıralı."""
    now = clock.now()
    start = max(start or now, now)
    end = end or start + timedelta(hours=24)
    if end <= start or end - start > timedelta(days=7):
        raise HTTPException(422, "Aralık en fazla 7 gün olabilir")

    results = []
    with tx() as conn:
        providers = conn.execute(
            """select * from providers
                where publish_slots and subcategory = %s and (%s::text is null or district = %s)""",
            (subcategory, district, district),
        ).fetchall()
        for p in providers:
            tz = ZoneInfo(p["timezone"])
            services = conn.execute(
                "select * from services where provider_id = %s and active order by price", (p["id"],)
            ).fetchall()
            if service:
                aranan = oneri.katla(service)
                services = [s for s in services if oneri.katla(s["name"]) == aranan]
            service_row = services[0] if services else None
            resources = conn.execute("select id from resources where provider_id = %s", (p["id"],)).fetchall()
            if not service_row or not resources:
                continue
            found: set[datetime] = set()
            strips: dict[date, list[bool]] = {}
            day = start.astimezone(tz).date()
            last_day = end.astimezone(tz).date()
            while day <= last_day and len(found) < 3:
                for r in resources:
                    starts, day_strip = availability.free_starts_for_day(
                        conn, r["id"], service_row, day, tz, now, window=(start, end)
                    )
                    found.update(starts)
                    merged = strips.get(day, [False] * availability.STRIP_SEGMENTS)
                    strips[day] = [a or b for a, b in zip(merged, day_strip)]
                day += timedelta(days=1)
            if found:
                first = sorted(found)[:3]
                strip_day = first[0].astimezone(tz).date()   # şerit, en erken boş saatin gününü gösterir
                results.append({
                    "provider": provider_public(p), "service": service_public(service_row),
                    "slots": [s.isoformat() for s in first],
                    "strip_day": strip_day.isoformat(), "strip": strips[strip_day],
                })
    results.sort(key=lambda r: r["slots"][0])
    return {"start": start.isoformat(), "end": end.isoformat(), "results": results}


@app.get("/providers/{slug}")
def provider_detail(slug: str):
    with tx() as conn:
        p = get_provider(conn, slug)
        services = conn.execute(
            "select * from services where provider_id = %s and active order by price", (p["id"],)
        ).fetchall()
    return {"provider": provider_public(p), "services": [service_public(s) for s in services]}


@app.get("/providers/{slug}/slots")
def provider_slots(slug: str, service_id: UUID, day: date):
    """Bir günün boş başlangıç saatleri ve gün şeridi."""
    now = clock.now()
    with tx() as conn:
        p = get_provider(conn, slug)
        tz = ZoneInfo(p["timezone"])
        service = conn.execute(
            "select * from services where id = %s and provider_id = %s and active", (service_id, p["id"])
        ).fetchone()
        if not service:
            raise HTTPException(404, "Hizmet bulunamadı")
        found: set[datetime] = set()
        strip = [False] * availability.STRIP_SEGMENTS
        for r in conn.execute("select id from resources where provider_id = %s", (p["id"],)).fetchall():
            starts, day_strip = availability.free_starts_for_day(conn, r["id"], service, day, tz, now)
            found.update(starts)
            strip = [a or b for a, b in zip(strip, day_strip)]
    return {"day": day.isoformat(), "slots": [s.isoformat() for s in sorted(found)], "strip": strip}


# ---------------------------------------------------------------- randevu

class BookingIn(BaseModel):
    provider_slug: str
    service_id: UUID
    start: datetime
    source: str = Field(default="discover", pattern="^(discover|link|waitlist)$")
    consent_health: bool = False


@app.post("/bookings", status_code=201)
def create_booking(body: BookingIn, user_id: UUID = Depends(current_user)):
    now = clock.now()
    if body.start.tzinfo is None:
        raise HTTPException(422, "Saat dilimi bilgisi gerekli")
    with tx() as conn:
        p = get_provider(conn, body.provider_slug)
        tz = ZoneInfo(p["timezone"])
        service = conn.execute(
            "select * from services where id = %s and provider_id = %s and active", (body.service_id, p["id"])
        ).fetchone()
        if not service:
            raise HTTPException(404, "Hizmet bulunamadı")
        needs_consent = p["category"] in HEALTH_CATEGORIES
        if needs_consent and not body.consent_health:
            raise HTTPException(422, "Sağlık randevusu için açık rıza gerekli")

        start = body.start.astimezone(timezone.utc)
        service_end = start + timedelta(minutes=service["duration_min"])
        occupied_end = service_end + timedelta(minutes=service["buffer_min"])
        day = start.astimezone(tz).date()

        booking_id = None
        for r in conn.execute("select id from resources where provider_id = %s order by name", (p["id"],)).fetchall():
            starts, _ = availability.free_starts_for_day(conn, r["id"], service, day, tz, now)
            if start not in starts:
                continue
            for _attempt in range(5):  # VUU kodu çakışırsa yeniden dene
                try:
                    with conn.transaction():
                        booking_id = conn.execute(
                            """insert into bookings (code, user_id, provider_id, resource_id, service_id, during,
                                                     service_end, source, price, consent_health_at)
                               values (%s, %s, %s, %s, %s, tstzrange(%s, %s), %s, %s, %s, %s) returning id""",
                            (vuu_code(), user_id, p["id"], r["id"], service["id"], start, occupied_end,
                             service_end, body.source, service["price"], now if needs_consent else None),
                        ).fetchone()["id"]
                    break
                except psycopg.errors.ExclusionViolation:
                    break      # bu kaynakta saat az önce doldu; sıradaki kaynağı dene
                except psycopg.errors.UniqueViolation:
                    continue
            if booking_id:
                break
        if not booking_id:
            raise HTTPException(409, "Bu saat az önce doldu")

        if p["deposit_amount"] > 0:
            ref = gateway.charge(p["deposit_amount"], f"on-odeme:{booking_id}")
            conn.execute(
                "insert into payments (booking_id, kind, method, amount, gateway_ref) values (%s, 'deposit', 'online', %s, %s)",
                (booking_id, p["deposit_amount"], ref),
            )
            conn.execute("update bookings set deposit_paid = %s where id = %s", (p["deposit_amount"], booking_id))
        conn.execute(
            "update waitlist set status = 'booked' where user_id = %s and provider_id = %s and status in ('waiting', 'offered')",
            (user_id, p["id"]),
        )
        row = conn.execute(BOOKING_SELECT + " where b.id = %s", (booking_id,)).fetchone()
    return booking_public(row)


@app.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: UUID, user_id: UUID = Depends(current_user)):
    """İptal kuralı: işletmenin belirlediği süreden önce iptal edilirse ön ödeme iade edilir."""
    now = clock.now()
    with tx() as conn:
        b = conn.execute(
            """select b.*, lower(b.during) as s, upper(b.during) as e, p.cancel_hours
                 from bookings b join providers p on p.id = b.provider_id
                where b.id = %s and b.user_id = %s for update of b""",
            (booking_id, user_id),
        ).fetchone()
        if not b:
            raise HTTPException(404, "Randevu bulunamadı")
        if b["status"] != "confirmed":
            raise HTTPException(409, "Bu randevu iptal edilemez")
        refund = b["deposit_paid"] > 0 and now <= b["s"] - timedelta(hours=b["cancel_hours"])
        if refund:
            ref = gateway.refund(b["deposit_paid"], f"iade:{booking_id}")
            conn.execute(
                "insert into payments (booking_id, kind, method, amount, gateway_ref) values (%s, 'refund', 'online', %s, %s)",
                (booking_id, -b["deposit_paid"], ref),
            )
        conn.execute(
            "update bookings set status = 'cancelled', cancelled_at = %s, deposit_refunded = %s where id = %s",
            (now, refund, booking_id),
        )
        # Boşalan saat, bekleme listesinde o aralığı isteyen ilk kişiye teklif edilir.
        offered = conn.execute(
            """update waitlist set status = 'offered', offered_at = %s
                where id = (select id from waitlist
                             where provider_id = %s and status = 'waiting' and wanted && tstzrange(%s, %s)
                             order by created_at limit 1 for update skip locked)
            returning id""",
            (now, b["provider_id"], b["s"], b["e"]),
        ).fetchone()
    return {"cancelled": True, "deposit_refunded": refund, "offered_to_waitlist": bool(offered)}


class WaitlistIn(BaseModel):
    provider_slug: str
    service_id: UUID
    start: datetime
    end: datetime


@app.post("/waitlist", status_code=201)
def join_waitlist(body: WaitlistIn, user_id: UUID = Depends(current_user)):
    if body.end <= body.start:
        raise HTTPException(422, "Geçersiz aralık")
    with tx() as conn:
        p = get_provider(conn, body.provider_slug)
        row = conn.execute(
            """insert into waitlist (user_id, provider_id, service_id, wanted)
               values (%s, %s, %s, tstzrange(%s, %s)) returning id""",
            (user_id, p["id"], body.service_id, body.start, body.end),
        ).fetchone()
        position = conn.execute(
            "select count(*) as n from waitlist where provider_id = %s and status = 'waiting'", (p["id"],)
        ).fetchone()["n"]
    return {"id": str(row["id"]), "position": position}


# ---------------------------------------------------------------- etkinlik ve bilet

def event_public(e: dict) -> dict:
    return {
        "id": str(e["id"]), "slug": e["slug"], "title": e["title"], "description": e["description"],
        "category": e["category"], "start": e["starts_at"].isoformat(), "end": e["ends_at"].isoformat(),
        "place": e["place"], "district": e["district"], "capacity": e["capacity"], "sold": e["sold"],
        "price": e["price"], "visibility": e["visibility"], "organizer": e.get("organizer_name", ""),
    }


EVENT_SELECT = "select e.*, u.name as organizer_name from events e join users u on u.id = e.organizer_user_id"


@app.get("/events")
def list_events(district: str | None = None):
    """Keşif akışı: yalnızca açık etkinlikler. Özel etkinlikler burada hiç görünmez."""
    with tx() as conn:
        rows = conn.execute(
            EVENT_SELECT + """ where e.visibility = 'public' and e.status = 'published' and e.starts_at > %s
                               and (%s::text is null or e.district = %s) order by e.starts_at limit 50""",
            (clock.now(), district, district),
        ).fetchall()
    return {"events": [event_public(e) for e in rows]}


@app.get("/events/{slug}")
def event_detail(slug: str, invite: str | None = None):
    with tx() as conn:
        e = conn.execute(EVENT_SELECT + " where e.slug = %s", (slug,)).fetchone()
    if not e or (e["visibility"] == "private" and invite != e["invite_code"]):
        raise HTTPException(404, "Etkinlik bulunamadı")  # özel etkinliğin varlığı da sızmaz
    return event_public(e)


class EventIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = ""
    category: str = "diger"
    start: datetime
    end: datetime
    place: str
    district: str = ""
    capacity: int = Field(gt=0, le=5000)
    price: int = Field(ge=0)
    visibility: str = Field(default="public", pattern="^(public|private)$")


@app.post("/events", status_code=201)
def create_event(body: EventIn, user_id: UUID = Depends(current_user)):
    """Herkes etkinlik açabilir. Özel etkinlik davet kodu alır ve keşifte görünmez."""
    if body.end <= body.start or body.start <= clock.now():
        raise HTTPException(422, "Etkinlik zamanı geçersiz")
    invite = f"{slugify(body.title).split('-')[0].upper()[:8]}-{vuu_code()}" if body.visibility == "private" else None
    slug = f"{slugify(body.title)}-{secrets.token_hex(2)}"
    with tx() as conn:
        e = conn.execute(
            """insert into events (organizer_user_id, slug, title, description, category, starts_at, ends_at,
                                   place, district, capacity, price, visibility, invite_code)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning *""",
            (user_id, slug, body.title, body.description, body.category, body.start, body.end, body.place,
             body.district, body.capacity, body.price, body.visibility, invite),
        ).fetchone()
    out = event_public(e)
    out["invite_code"] = invite
    out["link"] = f"randevuu.app/d/{invite}" if invite else f"randevuu.app/e/{slug}"
    return out


class TicketIn(BaseModel):
    qty: int = Field(default=1, ge=1, le=10)
    invite: str | None = None


@app.post("/events/{slug}/tickets", status_code=201)
def buy_ticket(slug: str, body: TicketIn, user_id: UUID = Depends(current_user)):
    with tx() as conn:
        e = conn.execute("select * from events where slug = %s", (slug,)).fetchone()
        if not e or (e["visibility"] == "private" and body.invite != e["invite_code"]):
            raise HTTPException(404, "Etkinlik bulunamadı")
        # Kontenjan tek bir atomik güncellemeyle düşülür; eşzamanlı alımlar kapasiteyi aşamaz.
        updated = conn.execute(
            """update events set sold = sold + %s
                where id = %s and status = 'published' and starts_at > %s and sold + %s <= capacity
            returning sold""",
            (body.qty, e["id"], clock.now(), body.qty),
        ).fetchone()
        if not updated:
            raise HTTPException(409, "Yeterli yer kalmadı")
        amount = e["price"] * body.qty
        for _attempt in range(5):
            try:
                with conn.transaction():
                    t = conn.execute(
                        "insert into tickets (code, event_id, user_id, qty, amount) values (%s, %s, %s, %s, %s) returning *",
                        (vuu_code(), e["id"], user_id, body.qty, amount),
                    ).fetchone()
                break
            except psycopg.errors.UniqueViolation:
                continue
        else:
            raise HTTPException(503, "Bilet kodu üretilemedi, tekrar dene")
        if amount > 0:
            ref = gateway.charge(amount, f"bilet:{t['id']}")
            conn.execute(
                "insert into payments (ticket_id, kind, method, amount, gateway_ref) values (%s, 'ticket', 'online', %s, %s)",
                (t["id"], amount, ref),
            )
    return {"id": str(t["id"]), "code": t["code"], "qty": t["qty"], "amount": amount, "sold": updated["sold"]}


# ---------------------------------------------------------------- cüzdan

@app.get("/me/wallet")
def wallet(user_id: UUID = Depends(current_user)):
    """Kullanıcının yaklaşan koçanları: randevular, biletler ve bekleme listesi."""
    now = clock.now()
    with tx() as conn:
        bookings = conn.execute(
            BOOKING_SELECT + " where b.user_id = %s and b.status = 'confirmed' and b.service_end > %s order by lower(b.during)",
            (user_id, now),
        ).fetchall()
        tickets = conn.execute(
            """select t.id, t.code, t.qty, t.amount, e.slug, e.title, e.starts_at, e.ends_at, e.place, e.visibility
                 from tickets t join events e on e.id = t.event_id
                where t.user_id = %s and t.status = 'valid' and e.ends_at > %s order by e.starts_at""",
            (user_id, now),
        ).fetchall()
        waiting = conn.execute(
            """select w.id, w.status, lower(w.wanted) as s, upper(w.wanted) as e, p.name, p.slug,
                      (select count(*) from waitlist w2 where w2.provider_id = w.provider_id
                          and w2.status = 'waiting' and w2.created_at <= w.created_at) as position
                 from waitlist w join providers p on p.id = w.provider_id
                where w.user_id = %s and w.status in ('waiting', 'offered') and upper(w.wanted) > %s""",
            (user_id, now),
        ).fetchall()
    return {
        "bookings": [booking_public(b) for b in bookings],
        "tickets": [{"id": str(t["id"]), "code": t["code"], "qty": t["qty"], "amount": t["amount"], "slug": t["slug"], "title": t["title"],
                     "end": t["ends_at"].isoformat(),
                     "start": t["starts_at"].isoformat(), "place": t["place"], "visibility": t["visibility"]} for t in tickets],
        "waitlist": [{"id": str(w["id"]), "status": w["status"], "start": w["s"].isoformat(), "end": w["e"].isoformat(),
                      "provider": w["name"], "slug": w["slug"], "position": w["position"]} for w in waiting],
    }


# ---------------------------------------------------------------- işletme paneli

@app.get("/biz/{slug}/agenda")
def biz_agenda(slug: str, start: date, days: int = Query(default=6, ge=1, le=14), user_id: UUID = Depends(current_user)):
    """Haftalık ajanda: gün gün randevular, boş saatler ve gün şeridi."""
    now = clock.now()
    with tx() as conn:
        p = own_provider(conn, slug, user_id)
        tz = ZoneInfo(p["timezone"])
        service = conn.execute(
            "select * from services where provider_id = %s and active order by price limit 1", (p["id"],)
        ).fetchone()
        resources = conn.execute("select id from resources where provider_id = %s", (p["id"],)).fetchall()
        out = []
        for i in range(days):
            day = start + timedelta(days=i)
            day_start, day_end = availability.day_bounds(day, tz)
            rows = conn.execute(
                """select b.id, b.code, b.status, b.source, b.price, b.deposit_paid, lower(b.during) as s,
                          b.service_end, u.name as customer, s.name as service,
                          not exists (select 1 from bookings o where o.provider_id = b.provider_id
                                         and o.user_id = b.user_id and o.created_at < b.created_at) as first_visit
                     from bookings b join users u on u.id = b.user_id join services s on s.id = b.service_id
                    where b.provider_id = %s and b.status in ('confirmed', 'completed', 'no_show')
                      and b.during && tstzrange(%s, %s) order by lower(b.during)""",
                (p["id"], day_start, day_end),
            ).fetchall()
            free: set[datetime] = set()
            strip = [False] * availability.STRIP_SEGMENTS
            if service:
                for r in resources:
                    starts, day_strip = availability.free_starts_for_day(conn, r["id"], service, day, tz, now)
                    free.update(starts)
                    strip = [a or b for a, b in zip(strip, day_strip)]
            out.append({
                "day": day.isoformat(),
                "bookings": [{"id": str(r["id"]), "code": r["code"], "status": r["status"], "source": r["source"],
                              "start": r["s"].isoformat(), "end": r["service_end"].isoformat(), "customer": r["customer"],
                              "service": r["service"], "price": r["price"], "deposit_paid": r["deposit_paid"],
                              "first_visit": r["first_visit"]} for r in rows],
                "free_slots": [s.isoformat() for s in sorted(free)],
                "strip": strip,
            })
    return {"provider": provider_public(p), "publish_slots": p["publish_slots"], "days": out}


class PublishIn(BaseModel):
    publish_slots: bool


@app.post("/biz/{slug}/publish")
def biz_publish(slug: str, body: PublishIn, user_id: UUID = Depends(current_user)):
    """Ajanda = vitrin anahtarı: boş saatler keşifte görünsün mü?"""
    with tx() as conn:
        p = own_provider(conn, slug, user_id)
        conn.execute("update providers set publish_slots = %s where id = %s", (body.publish_slots, p["id"]))
    return {"publish_slots": body.publish_slots}


class CompleteIn(BaseModel):
    method: str = Field(default="card_onsite", pattern="^(card_onsite|cash)$")
    no_show: bool = False


@app.post("/biz/bookings/{booking_id}/complete")
def biz_complete(booking_id: UUID, body: CompleteIn, user_id: UUID = Depends(current_user)):
    """Randevu bitti: kalan tutar tahsil edilir, belge taslağı kendiliğinden doğar."""
    with tx() as conn:
        b = conn.execute(
            """select b.*, p.owner_user_id, p.receipt_kind from bookings b join providers p on p.id = b.provider_id
                where b.id = %s for update of b""",
            (booking_id,),
        ).fetchone()
        if not b or b["owner_user_id"] != user_id:
            raise HTTPException(404, "Randevu bulunamadı")
        if b["status"] != "confirmed":
            raise HTTPException(409, "Randevu zaten kapatılmış")
        if body.no_show:
            conn.execute("update bookings set status = 'no_show' where id = %s", (booking_id,))
            return {"status": "no_show", "receipt": None}
        balance = b["price"] - b["deposit_paid"]
        if balance > 0:
            conn.execute(
                "insert into payments (booking_id, kind, method, amount) values (%s, 'balance', %s, %s)",
                (booking_id, body.method, balance),
            )
        conn.execute("update bookings set status = 'completed' where id = %s", (booking_id,))
        receipt = conn.execute(
            "insert into receipts (booking_id, kind, amount) values (%s, %s, %s) returning id, kind, status",
            (booking_id, b["receipt_kind"], b["price"]),
        ).fetchone()
    return {"status": "completed", "receipt": {"id": str(receipt["id"]), "kind": receipt["kind"], "status": receipt["status"]}}


@app.post("/biz/receipts/{receipt_id}/issue")
def biz_issue_receipt(receipt_id: UUID, user_id: UUID = Depends(current_user)):
    """Belge kes. Entegratör bağlanana kadar numara yereldir; gerçek e-belge DEĞİLDİR."""
    with tx() as conn:
        r = conn.execute(
            """select r.*, p.owner_user_id from receipts r join bookings b on b.id = r.booking_id
                 join providers p on p.id = b.provider_id where r.id = %s for update of r""",
            (receipt_id,),
        ).fetchone()
        if not r or r["owner_user_id"] != user_id:
            raise HTTPException(404, "Belge bulunamadı")
        if r["status"] == "issued":
            raise HTTPException(409, "Belge zaten kesilmiş")
        number = f"TASLAK-{secrets.token_hex(4).upper()}"
        conn.execute(
            "update receipts set status = 'issued', issued_at = %s, external_no = %s where id = %s",
            (clock.now(), number, receipt_id),
        )
    return {"status": "issued", "external_no": number}


@app.get("/biz/{slug}/finance")
def biz_finance(slug: str, month: str = Query(pattern=r"^\d{4}-\d{2}$"), user_id: UUID = Depends(current_user)):
    """Ay özeti: randevu → tahsilat → makbuz. Her satır bir randevudan doğar."""
    with tx() as conn:
        p = own_provider(conn, slug, user_id)
        tz = ZoneInfo(p["timezone"])
        year, mon = int(month[:4]), int(month[5:])
        m_start = datetime(year, mon, 1, tzinfo=tz)
        m_end = datetime(year + (mon == 12), mon % 12 + 1, 1, tzinfo=tz)
        rows = conn.execute(
            """select b.id, b.status, b.price, b.deposit_paid, b.deposit_refunded, lower(b.during) as s,
                      u.name as customer, s.name as service,
                      coalesce((select sum(amount) from payments where booking_id = b.id), 0) as collected,
                      r.id as receipt_id, r.kind as receipt_kind, r.status as receipt_status
                 from bookings b join users u on u.id = b.user_id join services s on s.id = b.service_id
                 left join receipts r on r.booking_id = b.id
                where b.provider_id = %s and b.during && tstzrange(%s, %s) order by lower(b.during) desc""",
            (p["id"], m_start, m_end),
        ).fetchall()
    completed = [r for r in rows if r["status"] == "completed"]
    return {
        "month": month,
        "completed": len(completed),
        "collected": sum(r["collected"] for r in rows),
        "outstanding": sum(r["price"] - r["deposit_paid"] for r in rows if r["status"] == "confirmed"),
        "receipts_issued": sum(1 for r in completed if r["receipt_status"] == "issued"),
        "receipts_pending": sum(1 for r in completed if r["receipt_status"] == "draft"),
        "rows": [{"booking_id": str(r["id"]), "start": r["s"].isoformat(), "customer": r["customer"], "service": r["service"],
                  "status": r["status"], "price": r["price"], "collected": r["collected"],
                  "receipt": ({"id": str(r["receipt_id"]), "kind": r["receipt_kind"], "status": r["receipt_status"]}
                              if r["receipt_id"] else None)} for r in rows],
    }


@app.get("/biz/{slug}/analytics")
def biz_analytics(slug: str, days: int = Query(default=30, ge=7, le=90), user_id: UUID = Depends(current_user)):
    """Son N gün: doluluk, gelmeyen oranı, tekrar gelen müşteri, randevunun geldiği kanal."""
    now = clock.now()
    since = now - timedelta(days=days)
    with tx() as conn:
        p = own_provider(conn, slug, user_id)
        tz = ZoneInfo(p["timezone"])
        rows = conn.execute(
            """select b.user_id, b.status, b.source, lower(b.during) as s, b.service_end
                 from bookings b where b.provider_id = %s and b.status <> 'cancelled'
                  and lower(b.during) >= %s and lower(b.during) < %s""",
            (p["id"], since, now),
        ).fetchall()
        hours = conn.execute(
            """select w.weekday, w.start_time, w.end_time from working_hours w
                 join resources r on r.id = w.resource_id where r.provider_id = %s""",
            (p["id"],),
        ).fetchall()
        returning = conn.execute(
            """select count(*) as n from (select user_id from bookings
                 where provider_id = %s and status in ('confirmed', 'completed') group by user_id having count(*) > 1) t""",
            (p["id"],),
        ).fetchone()["n"]
    per_weekday = [0.0] * 7
    for h in hours:
        per_weekday[h["weekday"]] += (
            datetime.combine(date.min, h["end_time"]) - datetime.combine(date.min, h["start_time"])
        ).total_seconds() / 60
    first_day = since.astimezone(tz).date()
    open_min = sum(per_weekday[(first_day + timedelta(days=i)).weekday()] for i in range(days))
    booked_min = sum((r["service_end"] - r["s"]).total_seconds() / 60 for r in rows if r["status"] != "no_show")
    customers = {r["user_id"] for r in rows}
    sources: dict[str, int] = {}
    for r in rows:
        sources[r["source"]] = sources.get(r["source"], 0) + 1
    total = len(rows)
    return {
        "days": days,
        "bookings": total,
        "occupancy": round(booked_min / open_min, 3) if open_min else 0,
        "no_show_rate": round(sum(1 for r in rows if r["status"] == "no_show") / total, 3) if total else 0,
        "customers": len(customers),
        "returning_customers": returning,
        "sources": sources,
    }
