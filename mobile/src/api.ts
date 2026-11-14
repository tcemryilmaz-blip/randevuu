// API istemcisi, tipler ve biçimlendiriciler.

import { metinler, t } from '@/config';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
// Geliştirme kimliği: gerçek girişte telefonla doğrulama (OTP) gelecek.
export const USER_ID = process.env.EXPO_PUBLIC_DEMO_USER ?? '00000000-0000-4000-8000-000000000001';

export type Provider = {
  slug: string; name: string; title: string; category: string; subcategory: string;
  district: string; address: string; deposit_amount: number; cancel_hours: number;
  needs_health_consent: boolean;
};
export type Service = { id: string; name: string; duration_min: number; price: number };
export type SearchResult = { provider: Provider; service: Service; slots: string[]; strip_day: string; strip: boolean[] };
export type DaySlots = { day: string; slots: string[]; strip: boolean[] };
export type Booking = {
  id: string; code: string; status: string; start: string; end: string; price: number;
  deposit_paid: number; provider: { slug: string; name: string; address: string }; service: string;
};
export type EventItem = {
  id: string; slug: string; title: string; description: string; category: string; start: string; end: string;
  place: string; district: string; capacity: number; sold: number; price: number; visibility: string; organizer: string;
};
export type Ticket = { id: string; code: string; qty: number; amount: number; slug: string; title: string; start: string; end: string; place: string; visibility: string };
export type Kategori = { id: string; ad: string; adet: number };
export type Oneri = { tur: 'alan' | 'hizmet' | 'isletme'; etiket: string; alt: string; alan: string; hizmet?: string; slug?: string };
export type WaitItem = { id: string; status: string; start: string; end: string; provider: string; slug: string; position: number };
export type Wallet = { bookings: Booking[]; tickets: Ticket[]; waitlist: WaitItem[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-User-Id': USER_ID, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = 'Bir şeyler ters gitti';
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&');

export const api = {
  search: (subcategory: string, start: string, end: string, service?: string, district = metinler.marka.sehir) =>
    request<{ results: SearchResult[] }>(`/search?${qs({ subcategory, district, service, start, end })}`),
  categories: () => request<{ categories: Kategori[] }>('/categories'),
  suggest: (q: string) => request<{ suggestions: Oneri[] }>(`/suggest?${qs({ q })}`),
  provider: (slug: string) => request<{ provider: Provider; services: Service[] }>(`/providers/${slug}`),
  slots: (slug: string, serviceId: string, day: string) =>
    request<DaySlots>(`/providers/${slug}/slots?${qs({ service_id: serviceId, day })}`),
  book: (body: { provider_slug: string; service_id: string; start: string; consent_health: boolean }) =>
    request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  cancel: (id: string) =>
    request<{ deposit_refunded: boolean }>(`/bookings/${id}/cancel`, { method: 'POST' }),
  joinWaitlist: (body: { provider_slug: string; service_id: string; start: string; end: string }) =>
    request<{ position: number }>('/waitlist', { method: 'POST', body: JSON.stringify(body) }),
  events: (district = metinler.marka.sehir) => request<{ events: EventItem[] }>(`/events?${qs({ district })}`),
  event: (slug: string) => request<EventItem>(`/events/${slug}`),
  buyTicket: (slug: string, qty: number) =>
    request<{ id: string; code: string; qty: number; amount: number }>(`/events/${slug}/tickets`, { method: 'POST', body: JSON.stringify({ qty }) }),
  wallet: () => request<Wallet>('/me/wallet'),
};

// ---------------------------------------------------------------- zaman
// Türkiye yıl boyu UTC+3'tür; cihazın saat diliminden bağımsız göstermek için sabit kaydırma kullanılır.

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad = (n: number) => String(n).padStart(2, '0');
const tr = (iso: string | Date) => new Date(new Date(iso).getTime() + TR_OFFSET_MS);

export const saat = (iso: string) => `${pad(tr(iso).getUTCHours())}:${pad(tr(iso).getUTCMinutes())}`;
export const gunKisa = (iso: string | Date) => GUN[tr(iso).getUTCDay()];
export const gunNo = (iso: string | Date) => tr(iso).getUTCDate();
export const tarih = (iso: string | Date) => `${GUN[tr(iso).getUTCDay()]} ${tr(iso).getUTCDate()} ${AY[tr(iso).getUTCMonth()]}`;
export const gunISO = (d: Date) => tr(d).toISOString().slice(0, 10);
export const ayniGun = (a: string | Date, b: string | Date) => gunISO(new Date(a)) === gunISO(new Date(b));

/** Bir Türkiye gününün verilen saatini ISO (UTC) olarak döndürür. */
export function trSaat(gun: string, hour: number, minute = 0): string {
  return new Date(Date.parse(`${gun}T${pad(hour)}:${pad(minute)}:00+03:00`)).toISOString();
}

/** Slotun gün şeridindeki dilim sırası (şerit 09:00'da başlar, dilimler 30 dk). */
export function seritSirasi(iso: string): number {
  const d = tr(iso);
  return Math.floor(((d.getUTCHours() - 9) * 60 + d.getUTCMinutes()) / 30);
}

export const para = (kurus: number) =>
  kurus === 0 ? t('genel.ucretsiz') : `${Math.round(kurus / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₺`;

// ---------------------------------------------------------------- zaman pencereleri ("Ne zaman boşsun?")

export type Pencere = { id: string; ad: string; start: string; end: string; gizli?: boolean };

export function pencereler(now = new Date()): Pencere[] {
  const bugun = gunISO(now);
  const gun = (n: number) => gunISO(new Date(now.getTime() + n * 86400000));
  const haftaGunu = tr(now).getUTCDay(); // 0 = Pazar
  const pazar = haftaGunu === 0;
  const cumartesiye = pazar ? 0 : 6 - haftaGunu; // pazar günü "hafta sonu" bugündür
  const ad = metinler.pencere;
  const list: Pencere[] = [
    { id: 'simdi', ad: ad.simdi, start: now.toISOString(), end: new Date(now.getTime() + 3 * 3600000).toISOString() },
    { id: 'aksam', ad: ad.aksam, start: trSaat(bugun, 17), end: trSaat(bugun, 22) },
    { id: 'yarin', ad: ad.yarin, start: trSaat(gun(1), 7), end: trSaat(gun(1), 22) },
    { id: 'yarinAksam', ad: ad.yarinAksam, start: trSaat(gun(1), 17), end: trSaat(gun(1), 22), gizli: true },
    { id: 'haftasonu', ad: ad.haftasonu, start: trSaat(gun(cumartesiye), 7), end: trSaat(gun(pazar ? 0 : cumartesiye + 1), 22) },
    { id: 'hafta', ad: ad.hafta, start: now.toISOString(), end: new Date(now.getTime() + 7 * 86400000 - 60000).toISOString() },
  ];
  // Bitmiş pencereleri (ör. gece yarısına yakın "Bu akşam") gösterme.
  return list.filter((p) => new Date(p.end).getTime() > now.getTime());
}

// ---------------------------------------------------------------- arama metni

const KATLA: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Yarın Akşam" → "yarin aksam". */
export const katla = (s: string) => s.replace(/[çğıöşüâîûÇĞİIÖŞÜ]/g, (c) => KATLA[c] ?? c).toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Aranan cümleden zamanı ayıklar: "manikür yarın akşam" → { pencere: 'yarinAksam', kalan: 'manikür' }.
 * Kelimeler config/metinler.ts → arama.zamanKelimeleri içindedir; uzun ifadeler önce denenir.
 */
export function zamanAyikla(metin: string): { pencere?: string; kalan: string } {
  const ifadeler = Object.entries(metinler.arama.zamanKelimeleri)
    .flatMap(([pencere, liste]) => (liste as string[]).map((k) => ({ pencere, k: katla(k) })))
    .sort((a, b) => b.k.length - a.k.length);
  let kalan = ` ${katla(metin).replace(/[,.;]/g, ' ')} `;
  let pencere: string | undefined;
  for (const { pencere: p, k } of ifadeler) {
    const aranan = ` ${k} `;
    if (kalan.includes(aranan)) {
      pencere = pencere ?? p;
      kalan = kalan.replace(aranan, ' ');
    }
  }
  return { pencere, kalan: kalan.replace(/\s+/g, ' ').trim() };
}

// ---------------------------------------------------------------- uzun tarih biçimleri

const GUN_UZUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const gunUzun = (iso: string) => GUN_UZUN[tr(iso).getUTCDay()];
export const ayUzun = (iso: string) => AY_UZUN[tr(iso).getUTCMonth()];
export const yil = (iso: string) => tr(iso).getUTCFullYear();
