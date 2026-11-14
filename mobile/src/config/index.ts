// AYAR MERKEZİ: tema, metinler ve maskot tek kapıdan okunur.
//
// Değiştirmenin iki yolu var:
//   1. Dosyadan: config/tema.ts, config/metinler.ts, config/maskot.ts (yeni sürümle yayılır).
//   2. Uzaktan: sunucudaki backend/app_config.json. Uygulama açılırken /app-config okunur ve
//      aynı anahtarlar varsayılanların üzerine yazılır. Mağazaya yeni sürüm göndermeden bir
//      cümleyi, bir rengi ya da Vuu'nun bir sözünü değiştirebilirsin.

import { maskot, MaskotHal, Sahne } from './maskot';
import { metinler } from './metinler';
import { tema } from './tema';

export { maskot, metinler, tema };
export type { MaskotHal, Sahne };

type Degisken = Record<string, string | number>;

const doldur = (kalip: string, d?: Degisken) =>
  d ? kalip.replace(/\{(\w+)\}/g, (_, k: string) => (k in d ? String(d[k]) : `{${k}}`)) : kalip;

/** Metin oku: t('isletme.ayirt') ya da t('ara.sonuc', { n: 3, sehir: 'Kadıköy' }). */
export function t(anahtar: string, d?: Degisken): string {
  const deger = anahtar.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), metinler);
  return typeof deger === 'string' ? doldur(deger, d) : anahtar; // eksik anahtar ekranda görünür, sessizce kaybolmaz
}

/** Vuu'nun bir olay anındaki hali ve sözü. */
export function sahne(ad: Sahne, d?: Degisken): { hal: MaskotHal; soz: string } {
  const s = maskot.sahne[ad];
  return { hal: s.hal, soz: doldur(s.soz, d) };
}

// ---------------------------------------------------------------- uzaktan ayar

function birlestir(hedef: Record<string, unknown>, kaynak: Record<string, unknown>) {
  for (const [k, v] of Object.entries(kaynak)) {
    if (!(k in hedef)) continue; // bilinmeyen anahtar yok sayılır: uzaktan yalnızca var olan ayarlar değişir
    const mevcut = hedef[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && mevcut && typeof mevcut === 'object' && !Array.isArray(mevcut)) {
      birlestir(mevcut as Record<string, unknown>, v as Record<string, unknown>);
    } else if (typeof v === typeof mevcut) {
      hedef[k] = v;
    }
  }
}

/** Sunucudaki ayarları varsayılanların üzerine yazar. Ulaşılamazsa sessizce varsayılanlarla devam eder. */
export async function uzakAyarlariYukle(apiUrl: string, zamanAsimiMs = 1500): Promise<boolean> {
  const kontrol = new AbortController();
  const sayac = setTimeout(() => kontrol.abort(), zamanAsimiMs);
  try {
    const res = await fetch(`${apiUrl}/app-config`, { signal: kontrol.signal });
    if (!res.ok) return false;
    const uzak = (await res.json()) as Record<string, unknown>;
    birlestir({ tema, metinler, maskot } as unknown as Record<string, unknown>, uzak);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(sayac);
  }
}
