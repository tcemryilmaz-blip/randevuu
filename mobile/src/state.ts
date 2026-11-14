// Küçük uygulama durumu: aranan şey ve zaman (Keşfet ile Ara ortak kullanır), son aramalar, veri kancası.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { t } from '@/config';

// ---------------------------------------------------------------- küçük gözlemlenebilir depo

function depo<T>(ilk: T) {
  let deger = ilk;
  const dinleyenler = new Set<() => void>();
  return {
    al: () => deger,
    ayarla: (yeni: T) => {
      deger = yeni;
      dinleyenler.forEach((f) => f());
    },
    kullan: () =>
      useSyncExternalStore(
        (f) => {
          dinleyenler.add(f);
          return () => dinleyenler.delete(f);
        },
        () => deger,
        () => deger,
      ),
  };
}

// ---------------------------------------------------------------- aranan şey

/** alan: hizmet alanı (katalog id'si) · hizmet: belirli bir hizmet adı · etiket: kullanıcıya görünen ad. */
export type Secim = { alan?: string; hizmet?: string; etiket?: string; pencere: string };

const secimDeposu = depo<Secim>({ pencere: 'hafta' });

export const secimiAyarla = (yeni: Partial<Secim>) => secimDeposu.ayarla({ ...secimDeposu.al(), ...yeni });
export const secimiTemizle = () => secimDeposu.ayarla({ pencere: secimDeposu.al().pencere });
export const useSecim = secimDeposu.kullan;

// ---------------------------------------------------------------- son aramalar (cihazda saklanır)

export type SonArama = { etiket: string; alan: string; hizmet?: string };

const SON_ANAHTAR = 'son-aramalar';
const sonDeposu = depo<SonArama[]>([]);
AsyncStorage.getItem(SON_ANAHTAR)
  .then((v) => { if (v) sonDeposu.ayarla(JSON.parse(v) as SonArama[]); })
  .catch(() => {});

export function sonAramaEkle(a: SonArama) {
  const liste = [a, ...sonDeposu.al().filter((x) => !(x.alan === a.alan && x.hizmet === a.hizmet))].slice(0, 6);
  sonDeposu.ayarla(liste);
  AsyncStorage.setItem(SON_ANAHTAR, JSON.stringify(liste)).catch(() => {});
}
export const useSonAramalar = sonDeposu.kullan;

// ---------------------------------------------------------------- veri kancası

/** Asenkron veri: { data, error, loading, reload }. Eski isteklerin yanıtı yenisini ezmez. */
export function useVeri<T>(getir: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sira = useRef(0);
  const reload = useCallback(() => {
    const benim = ++sira.current;
    setLoading(true);
    getir()
      .then((d) => {
        if (benim === sira.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (benim === sira.current) setError(e.message === 'Failed to fetch' || e.message === 'Network request failed' ? t('genel.ulasilamadi') : e.message);
      })
      .finally(() => {
        if (benim === sira.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}
