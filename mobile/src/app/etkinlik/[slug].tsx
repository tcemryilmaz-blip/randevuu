// Etkinlik ve bilet: "kimler geliyor?" çizgisi, seçtiğin bilet sayısı kadar mercana döner.

import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, para, saat, tarih } from '@/api';
import { Durum } from '@/components/kartlar';
import { VuuDer } from '@/components/Maskot';
import { BiletKarti } from '@/components/randevuun';
import { Baslik, Bolum, Dugme, Etiket, Geri, Kart, KontenjanCizgisi } from '@/components/ui';
import { sahne, t, tema } from '@/config';
import { useVeri } from '@/state';

function Adim({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled: boolean }) {
  const r = tema.renk;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled }}
      style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: disabled ? r.dolu : r.sis, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 20, color: disabled ? r.doluYazi : r.murekkep }}>{label}</Text>
    </Pressable>
  );
}

export default function Etkinlik() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const r = tema.renk;
  const etkinlik = useVeri(() => api.event(slug), [slug]);
  const [adet, setAdet] = useState(1);
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [bilet, setBilet] = useState<{ id: string; code: string; qty: number; amount: number } | null>(null);
  const e = etkinlik.data;
  const kalan = e ? e.capacity - e.sold : 0;

  const al = async () => {
    setGonderiliyor(true);
    setHata(null);
    try {
      setBilet(await api.buyTicket(slug, adet));
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : t('genel.ulasilamadi'));
      etkinlik.reload();
    } finally {
      setGonderiliyor(false);
    }
  };

  if (bilet && e) {
    const vuu = sahne('biletHazir');
    return (
      <ScrollView style={{ flex: 1, backgroundColor: r.mercan }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 8, gap: 22 }}>
        <Baslik ince={t('basari.biletInce')} kalin={t('basari.biletKalin')} size={44} altAlta />
        <BiletKarti zemin={r.mercan} qrBoyut={168} style={{ transform: [{ rotate: '-1.5deg' }] }}
          b={{ id: bilet.id, code: bilet.code, qty: bilet.qty, amount: bilet.amount, title: e.title, start: e.start, end: e.end, place: e.place, visibility: e.visibility }} />
        <VuuDer hal={vuu.hal} soz={vuu.soz} boyut={92} arka={r.beyaz} />
        <Dugme tur="koyu" onPress={() => router.replace('/cuzdan')}>{t('basari.git')}</Dugme>
      </ScrollView>
    );
  }

  const vuu = hata ? { ...sahne('hata'), soz: `${sahne('hata').soz} ${hata}` } : kalan === 0 ? sahne('etkinlikDolu') : sahne('etkinlik');

  return (
    <View style={{ flex: 1, backgroundColor: r.murekkep }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 56, gap: 14 }}>
          <View style={{ position: 'absolute', right: -60, top: insets.top + 10, width: 220, height: 220, borderRadius: 110, backgroundColor: r.murekkep2 }} />
          <Geri koyuZemin onPress={() => router.back()} label={t('genel.geri')} />
          {e && (
            <>
              <Etiket>{t(e.visibility === 'private' ? 'etkinlik.etiketOzel' : 'etkinlik.etiketAcik')}</Etiket>
              <Text accessibilityRole="header" style={{ fontFamily: tema.yazi.baslik, fontSize: 34, lineHeight: 38, color: r.beyaz }}>{e.title}</Text>
              <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 17, color: r.sari }}>{tarih(e.start)} · {saat(e.start)}–{saat(e.end)}</Text>
              <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, lineHeight: 20, color: r.lila }}>{t('etkinlik.bulusma', { yer: e.place, kim: e.organizer })}</Text>
            </>
          )}
          <Durum koyuZemin loading={etkinlik.loading && !e} error={etkinlik.error} onRetry={etkinlik.reload} />
        </View>

        {e && (
          <View style={{ flexGrow: 1, backgroundColor: r.sis, borderTopLeftRadius: tema.kose.sayfa, borderTopRightRadius: tema.kose.sayfa, marginTop: -30, padding: 16, paddingTop: 22, gap: 16 }}>
            <Kart style={{ gap: 14 }}>
              <Bolum sag={kalan === 0 ? t('kart.tukendi') : t('etkinlik.durum', { dolu: e.sold, kalan })}>{t('etkinlik.kontenjan')}</Bolum>
              <KontenjanCizgisi kapasite={e.capacity} dolu={e.sold} senin={kalan > 0 ? adet : 0} />
              {!!e.description && <Text style={{ fontFamily: tema.yazi.metin, fontSize: 15, lineHeight: 23, color: r.duman }}>{e.description}</Text>}
            </Kart>
            {kalan > 0 && (
              <Kart style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: r.murekkep }}>{t('etkinlik.bilet')}</Text>
                  <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{t('etkinlik.kisiBasi', { tutar: para(e.price) })}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Adim label="−" a11y={t('etkinlik.azalt')} disabled={adet <= 1} onPress={() => setAdet(adet - 1)} />
                  <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 20, color: r.murekkep, minWidth: 16, textAlign: 'center' }}>{adet}</Text>
                  <Adim label="+" a11y={t('etkinlik.arttir')} disabled={adet >= Math.min(kalan, 10)} onPress={() => setAdet(adet + 1)} />
                </View>
              </Kart>
            )}
            <VuuDer hal={vuu.hal} soz={vuu.soz} boyut={84} />
          </View>
        )}
      </ScrollView>
      {e && (
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: r.beyaz, borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0px -8px 24px rgba(23, 19, 43, 0.08)', gap: 8 }}>
          <Dugme disabled={kalan === 0 || gonderiliyor} onPress={al}>{kalan === 0 ? t('kart.tukendi') : gonderiliyor ? t('etkinlik.aliniyor') : t('etkinlik.al', { tutar: para(e.price * adet) })}</Dugme>
          <Text style={{ fontFamily: tema.yazi.metin, fontSize: 12, color: r.duman, textAlign: 'center' }}>{t('onay.gelistirme')}</Text>
        </View>
      )}
    </View>
  );
}
