-- randevuu çekirdek şeması
-- Tutarlar kuruş cinsinden tam sayıdır (1.200,00 TL = 120000).
-- Zamanlar timestamptz; aralıklar [başlangıç, bitiş) şeklinde tstzrange.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table users (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Hizmet veren işletme ya da serbest çalışan.
create table providers (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references users(id),
  slug            text unique not null,            -- randevuu.app/<slug>
  name            text not null,
  title           text not null default '',        -- "Diş hekimi"
  category        text not null,                   -- saglik, bakim, spor, egitim, evcil
  subcategory     text not null default '',        -- dis-hekimi, berber, pilates...
  district        text not null,
  address         text not null default '',
  lat             double precision,
  lng             double precision,
  timezone        text not null default 'Europe/Istanbul',
  publish_slots   boolean not null default true,   -- boş saatler keşifte görünsün mü
  deposit_amount  integer not null default 0,      -- ön ödeme (kuruş)
  cancel_hours    integer not null default 24,     -- ücretsiz iptal süresi
  receipt_kind    text not null default 'e-arsiv' check (receipt_kind in ('e-arsiv', 'e-smm')),
  created_at      timestamptz not null default now()
);
create index providers_search on providers (subcategory, district) where publish_slots;

-- Takvimi olan şey: bir uzman, bir koltuk, bir oda.
create table resources (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  name         text not null
);

create table services (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references providers(id) on delete cascade,
  name          text not null,
  duration_min  integer not null check (duration_min > 0),
  buffer_min    integer not null default 0 check (buffer_min >= 0),  -- randevu sonrası ara
  price         integer not null check (price >= 0),
  active        boolean not null default true
);

-- Haftalık çalışma saatleri. weekday: 0 = Pazartesi ... 6 = Pazar.
create table working_hours (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references resources(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  check (end_time > start_time)
);

-- Tek seferlik kapalı aralıklar: izin, öğle arası istisnası, dış takvimden gelen meşguliyet.
create table time_off (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references resources(id) on delete cascade,
  during       tstzrange not null,
  reason       text not null default ''
);
create index time_off_lookup on time_off using gist (resource_id, during);

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,                   -- VUU kodu; işletme içinde tekil
  user_id          uuid not null references users(id),
  provider_id      uuid not null references providers(id),
  resource_id      uuid not null references resources(id),
  service_id       uuid not null references services(id),
  during           tstzrange not null,              -- hizmet + ara süresi; takvimde kapladığı yer
  service_end      timestamptz not null,            -- müşteriye gösterilen bitiş
  status           text not null default 'confirmed'
                   check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  source           text not null default 'discover'
                   check (source in ('discover', 'link', 'waitlist', 'manual')),
  price            integer not null,
  deposit_paid     integer not null default 0,
  deposit_refunded boolean not null default false,
  consent_health_at timestamptz,                    -- sağlık kategorisinde açık rıza zamanı
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,

  -- Çift rezervasyon koruması: aynı kaynağın takviminde iki aktif randevu çakışamaz.
  -- Kontrolü uygulama değil veritabanı yapar; eşzamanlı iki istekten yalnızca biri geçer.
  constraint bookings_no_overlap exclude using gist (
    resource_id with =,
    during with &&
  ) where (status in ('confirmed', 'completed')),
  unique (provider_id, code)
);
create index bookings_user on bookings (user_id, lower(during));
create index bookings_provider on bookings (provider_id, lower(during));

create table waitlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  provider_id  uuid not null references providers(id),
  service_id   uuid not null references services(id),
  wanted       tstzrange not null,                  -- kullanıcının uygun olduğu aralık
  status       text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'expired')),
  offered_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index waitlist_lookup on waitlist using gist (provider_id, wanted) where status = 'waiting';

-- Etkinlik: kapasitesi 1'den büyük, tek seferlik bir "slot".
create table events (
  id                 uuid primary key default gen_random_uuid(),
  organizer_user_id  uuid not null references users(id),
  provider_id        uuid references providers(id),  -- işletme etkinliği ise
  slug               text unique not null,
  title              text not null,
  description        text not null default '',
  category           text not null default 'diger',
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  place              text not null,
  district           text not null default '',
  capacity           integer not null check (capacity > 0),
  sold               integer not null default 0 check (sold >= 0),
  price              integer not null default 0 check (price >= 0),
  visibility         text not null default 'public' check (visibility in ('public', 'private')),
  invite_code        text unique,                    -- yalnızca özel etkinlikte
  status             text not null default 'published' check (status in ('published', 'cancelled')),
  created_at         timestamptz not null default now(),
  check (ends_at > starts_at),
  check (sold <= capacity),                          -- kontenjan aşımı veritabanında da imkânsız
  check ((visibility = 'private') = (invite_code is not null))
);
create index events_discover on events (district, starts_at) where visibility = 'public' and status = 'published';

create table tickets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,                         -- VUU kodu; etkinlik içinde tekil
  event_id    uuid not null references events(id),
  user_id     uuid not null references users(id),
  qty         integer not null check (qty between 1 and 10),
  amount      integer not null,
  status      text not null default 'valid' check (status in ('valid', 'refunded', 'used')),
  created_at  timestamptz not null default now(),
  unique (event_id, code)
);
create index tickets_user on tickets (user_id);

-- Ödeme hareketleri. Gerçek tahsilat ödeme kuruluşunda yapılır; burada yalnızca kaydı tutulur.
create table payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings(id),
  ticket_id     uuid references tickets(id),
  kind          text not null check (kind in ('deposit', 'balance', 'ticket', 'refund')),
  method        text not null check (method in ('online', 'card_onsite', 'cash')),
  amount        integer not null,                    -- iade ise negatif
  gateway_ref   text,
  created_at    timestamptz not null default now(),
  check ((booking_id is not null) <> (ticket_id is not null))
);
create index payments_booking on payments (booking_id);

-- Belge (e-arşiv fatura / e-SMM). Randevu tamamlanınca taslak doğar, işletme onaylayınca kesilir.
create table receipts (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid unique not null references bookings(id),
  kind        text not null check (kind in ('e-arsiv', 'e-smm')),
  amount      integer not null,
  status      text not null default 'draft' check (status in ('draft', 'issued')),
  issued_at   timestamptz,
  external_no text                                   -- entegratörden dönen belge numarası
);
