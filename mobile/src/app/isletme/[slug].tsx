// İşletme sayfası: ne için, hangi gün, hangi an. Vuu seçime göre konuşur.

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, gunISO, gunKisa, gunNo, para, saat, seritSirasi, tarih, trSaat } from '@/api';
import { Durum } from '@/components/kartlar';
import { VuuDer } from '@/components/Maskot';
import { AnCizgisi, AnPulu, Bolum, Dugme, Geri, Kart } from '@/components/ui';
import { sahne, t, tema } from '@/config';
import { useVeri } from '@/state';

const ayniAn = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

export default function Isletme() {
  const { slug, start } = useLocalSearchParams<{ slug: string; start?: string }>();
  const insets = useSafeAreaInsets();
  const r = tema.renk;
  const gunler = useMemo(() => Array.from({ length: 7 }, (_, i) => gunISO(new Date(Date.now() + i * 86400000))), []);
  const [gun, setGun] = useState(start ? gunISO(new Date(start)) : gunler[0]);
  const [hizmetId, setHizmetId] = useState<string | null>(null);
  const [secim, setSecim] = useState<string | null>(start ?? null);
  const [sira, setSira] = useState<number | null>(null);

  const isletme = useVeri(() => api.provider(slug), [slug]);
  const hizmet = isletme.data?.services.find((s) => s.id === hizmetId) ?? isletme.data?.services[0];
  const anlar = useVeri(() => (hizmet ? api.slots(slug, hizmet.id, gun) : Promise.resolve(null)), [slug, hizmet?.id, gun]);
  const bos = anlar.data?.slots ?? [];

  // Seçili an artık boş değilse (gün ya da hizmet değişti, biri aldı) seçimi bırak.
  useEffect(() => {
    if (secim && anlar.data && !bos.some((b) => ayniAn(b, secim))) setSecim(null);
  }, [anlar.data]);

  const p = isletme.data?.provider;
  const dolu = !!anlar.data && bos.length === 0;
  const vuu = sira ? sahne('nobette') : dolu ? sahne('gunDolu') : secim ? sahne('anSecildi', { saat: saat(secim) }) : sahne('anSec');

  const haberVer = async () => {
    if (!hizmet) return;
    const sonuc = await api.joinWaitlist({ provider_slug: slug, service_id: hizmet.id, start: trSaat(gun, 7), end: trSaat(gun, 22) });
    setSira(sonuc.position);
  };

  return (
    <View style={{ flex: 1, backgroundColor: r.sis }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 24, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 }}>
          <Geri onPress={() => router.back()} label={t('genel.geri')} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontFamily: tema.yazi.baslik, fontSize: 24, color: r.murekkep }}>{p?.name ?? ' '}</Text>
            <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{p ? `${p.title} · ${p.address}` : ' '}</Text>
          </View>
        </View>
        <Durum loading={isletme.loading && !isletme.data} error={isletme.error} onRetry={isletme.reload} />

        {isletme.data && (
          <>
            <Kart style={{ gap: 12 }}>
              <Bolum>{t('isletme.hizmet')}</Bolum>
              {isletme.data.services.map((s) => {
                const aktif = s.id === hizmet?.id;
                return (
                  <Pressable key={s.id} onPress={() => setHizmetId(s.id)} accessibilityRole="radio" accessibilityState={{ selected: aktif }}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, borderRadius: tema.kose.pul, backgroundColor: aktif ? r.mercanAcik : r.sis }}>
                    <View>
                      <Text style={{ fontFamily: aktif ? tema.yazi.metinKalin : tema.yazi.metinOrta, fontSize: 15, color: r.murekkep }}>{s.name}</Text>
                      <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{t('isletme.dakika', { n: s.duration_min })}</Text>
                    </View>
                    <Text style={{ fontFamily: aktif ? tema.yazi.monoKalin : tema.yazi.mono, fontSize: 15, color: r.murekkep }}>{para(s.price)}</Text>
                  </Pressable>
                );
              })}
            </Kart>

            <Kart style={{ gap: 14 }}>
              <Bolum>{t('isletme.gun')}</Bolum>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {gunler.map((g) => {
                  const aktif = g === gun;
                  const d = g + 'T12:00:00+03:00';
                  return (
                    <Pressable key={g} onPress={() => { setGun(g); setSira(null); }} accessibilityRole="radio" accessibilityState={{ selected: aktif }} accessibilityLabel={tarih(d)}
                      style={{ width: 56, paddingVertical: 10, borderRadius: tema.kose.pul, alignItems: 'center', gap: 3, backgroundColor: aktif ? r.murekkep : r.sis }}>
                      <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 12, color: aktif ? r.lila : r.duman }}>{gunKisa(d)}</Text>
                      <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 18, color: aktif ? r.beyaz : r.murekkep }}>{gunNo(d)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Bolum>{t('isletme.saat')}</Bolum>
              {anlar.data && <AnCizgisi strip={anlar.data.strip} secili={secim ? seritSirasi(secim) : undefined} yukseklik={10} saatler />}
              <Durum loading={anlar.loading && !anlar.data} error={anlar.error} onRetry={anlar.reload} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {bos.map((b) => (
                  <AnPulu key={b} label={saat(b)} durum={secim && ayniAn(secim, b) ? 'secili' : 'bos'} onPress={() => setSecim(b)} style={{ width: '23%' }} />
                ))}
              </View>
            </Kart>

            <VuuDer hal={vuu.hal} soz={vuu.soz} boyut={84} />
            {dolu && !sira && <Dugme tur="koyu" onPress={haberVer}>{t('isletme.haberVer')}</Dugme>}
            {!!sira && (
              <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 14, color: r.murekkep, textAlign: 'center' }}>{t('isletme.siradaBaslik', { n: sira })}</Text>
            )}
          </>
        )}
      </ScrollView>

      {hizmet && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: r.beyaz, borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0px -8px 24px rgba(23, 19, 43, 0.08)' }}>
          <View>
            <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{secim ? `${tarih(secim)} · ${hizmet.name}` : t('isletme.sec')}</Text>
            <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 22, color: r.murekkep }}>{secim ? saat(secim) : '--:--'}</Text>
          </View>
          <Dugme disabled={!secim} onPress={() => secim && router.push({ pathname: '/onay', params: { slug, serviceId: hizmet.id, start: secim } })}>{t('isletme.ayirt')}</Dugme>
        </View>
      )}
    </View>
  );
}
