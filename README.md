# rande/VUU

Boş saati bul, yerini ayırt. Randevu, etkinlik biletleme ve işletmeler için ajanda, tahsilat, makbuz ve analitik tek çatı altında.

## Depo yapısı

| Klasör | Ne var |
| --- | --- |
| `backend/` | API ve çekirdek: FastAPI + PostgreSQL. Slot motoru, randevu, bekleme listesi, etkinlik ve bilet, işletme paneli uçları. |
| `mobile/` | iOS ve Android uygulaması: Expo (React Native, TypeScript). Web'de de çalışır. |

## Çalıştırma

### 1. API

PostgreSQL 14+ gerekir (`btree_gist` ve `pgcrypto` eklentileri şemayla birlikte kurulur).

```bash
cd backend
pip install -r requirements.txt
createdb randevuu
export DATABASE_URL=postgresql://postgres@localhost:5432/randevuu
python -m scripts.migrate      # şemayı kurar
python -m scripts.seed         # Kadıköy örnek verisi (uydurma işletmeler)
uvicorn app.main:app --reload  # http://localhost:8000/docs
```

Testler gerçek Postgres üzerinde çalışır, çünkü çift rezervasyon ve kontenjan kuralları veritabanı kısıtıdır:

```bash
createdb randevuu_test
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/randevuu_test pytest
```

### 2. Mobil uygulama

```bash
cd mobile
npm install
cp .env.example .env           # telefonda denerken API adresini bilgisayarın IP'siyle değiştir
npx expo start                 # Expo Go ile QR okut ya da "w" ile tarayıcıda aç
```

## Görünümü, metinleri ve Vuu'yu değiştirmek

Ekranlarda sabit metin, renk ya da ölçü yoktur. Her şey `mobile/src/config/` altındadır:

| Dosya | Ne değişir |
| --- | --- |
| `tema.ts` | Renkler, yazı tipleri, köşe yarıçapları, gölge, an çizgisinin kalınlığı, animasyonların açık/kapalı olması |
| `metinler.ts` | Uygulamadaki bütün yazılar: başlıklar, düğmeler, motto, arama örnekleri, aramada zamanı yakalayan kelimeler ("yarın akşam" gibi) |
| `maskot.ts` | Vuu'nun adı, tanışma hikâyesi ve her olayda söylediği söz ile hali; `acik: false` ile tamamen kapatılabilir |

Hizmet alanları ve aramada onlara götüren kelimeler ("dişçi" → Diş hekimi, "manikür" → Güzellik merkezi,
"oto kuaför" → Oto yıkama) sunucuda, `backend/catalog.json` içindedir. Yeni bir alan eklemek ya da eş anlamlı
kelime girmek için yalnızca bu dosya düzenlenir; sunucuyu yeniden başlatmak gerekmez.

Mağazaya yeni sürüm göndermeden değiştirmek için `backend/app_config.json` kullanılır. Uygulama açılırken
`/app-config` okunur ve aynı anahtarlar varsayılanların üzerine yazılır:

```json
{
  "metinler": { "kesfet": { "baslikInce": "Merhaba,", "baslikKalin": "ne arıyorsun?" } },
  "tema": { "renk": { "mercan": "#FF6A3D" } },
  "maskot": { "sahne": { "karsilama": { "soz": "Hoş geldin!" } } }
}
```

Sözlük: **an** = ayırtılabilir saat, **an çizgisi** = bir günün doluluğunu gösteren çizgi,
**randevuun** = ayırttığın her şey (randevu, bilet, davet), **randevuularım** = hepsinin durduğu yer,
**ön ödeme** = randevuyu tutmak için şimdi alınan tutar.

Hizmet randevusu **ajanda yaprağı**, etkinlik **bilet** biçiminde gösterilir. İkisinde de ortasında Vuu olan bir QR
vardır; QR en yüksek hata düzeltme düzeyiyle üretilir, bu yüzden ortadaki yüz okumayı bozmaz.

## Temel kararlar

- **Hiçbir alan dayatılmaz.** Açılışta kategori listesi yoktur; kullanıcı ne lazımsa yazar ("manikür yarın akşam"). Öneriler hizmet alanı, hizmet ve işletme olarak gelir, cümledeki zaman ayrıca yakalanır. Liste yalnızca istenince, alfabetik gösterilir. Sonuçlar en erken boş ana göre sıralanır.
- **Çift rezervasyonu veritabanı engeller.** `bookings` tablosundaki `EXCLUDE` kısıtı aynı kaynağın takviminde çakışan iki aktif randevuya izin vermez. Eşzamanlı isteklerden yalnızca biri geçer.
- **Etkinlik kontenjanı atomik düşer.** Bilet satışı tek bir `UPDATE ... WHERE sold + qty <= capacity` ile yapılır.
- **Randevuyla başlar, makbuzla biter.** Randevu tamamlanınca kalan tutar tahsil edilir ve belge taslağı (e-arşiv / e-SMM) kendiliğinden oluşur.
- **Özel etkinlik sızmaz.** Davet kodu olmadan özel etkinlik listede görünmez, adresi bilinse bile 404 döner.
- **Tutarlar kuruş**, zamanlar `timestamptz`; Türkiye saati yıl boyu UTC+3.

## Henüz gerçek olmayanlar

Bunlar bilinçli olarak yer tutucudur; canlıya çıkmadan önce tamamlanmalıdır.

| Konu | Şu anki durum | Gereken |
| --- | --- | --- |
| Giriş | `X-User-Id` başlığı (geliştirme) | Telefonla tek kullanımlık kod + oturum |
| Ödeme | `FakeGateway`: para hareketi yok | Lisanslı ödeme kuruluşuyla pazar yeri sözleşmesi |
| E-belge | Yerel `TASLAK-…` numarası, resmî belge değil | E-belge entegratörü |
| Bildirim | Yok | Push, SMS / WhatsApp hatırlatma; bekleme listesi teklifi |
| Takvim eşitleme | Yok | Google / Apple takvimi iki yönlü |
| KVKK | Açık rıza zamanı kaydediliyor | Aydınlatma metni, saklama ve silme süreçleri, hukuki inceleme |

## Sıradaki adımlar

1. İşletme web paneli (`ajanda/VUU`): ajanda, finans, analitik ekranları (API uçları hazır).
2. Uygulamada etkinlik açma (açık / özel) ve işletme modu.
3. Telefonla giriş.
4. Ödeme, e-belge ve bildirim entegrasyonları.
