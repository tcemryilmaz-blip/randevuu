// randevuularım: hizmet randevuları ajanda yaprağı, etkinlikler bilet olarak durur; haber beklediklerin altta.

import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, Booking, tarih } from '@/api';
import { Durum } from '@/components/kartlar';
import { VuuDer } from '@/components/Maskot';
import { AjandaKarti, BiletKarti } from '@/components/randevuun';
import { Baslik, Dugme } from '@/components/ui';
import { sahne, t, tema } from '@/config';
import { secimiTemizle, useVeri } from '@/state';

function RandevuSatiri({ b, yenile }: { b: Booking; yenile: () => void }) {
  const r = tema.renk;
  const [soruyor, setSoruyor] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const vazgec = async () => {
    try {
      const sonuc = await api.cancel(b.id);
      setMesaj(`${sahne('vazgecildi').soz} ${sonuc.deposit_refunded ? t('yerlerim.iptalIadeli') : ''}`.trim());
      setTimeout(yenile, 1600);
    } catch (e) {
      setMesaj((e as Error).message);
    }
  };
  return (
    <AjandaKarti b={b}>
      {mesaj ? (
        <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 14, lineHeight: 20, color: r.murekkep, textAlign: 'center' }}>{mesaj}</Text>
      ) : soruyor ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 14, color: r.murekkep, textAlign: 'center' }}>{t('yerlerim.iptalSoru')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Dugme tur="ana" onPress={() => setSoruyor(false)} style={{ flex: 1 }}>{t('yerlerim.iptalHayir')}</Dugme>
            <Dugme tur="cizgi" onPress={vazgec} style={{ flex: 1 }}>{t('yerlerim.iptalEvet')}</Dugme>
          </View>
        </View>
      ) : (
        <Dugme tur="sakin" onPress={() => setSoruyor(true)}>{t('yerlerim.iptal')}</Dugme>
      )}
    </AjandaKarti>
  );
}

export default function Cuzdan() {
  const ust = useSafeAreaInsets().top;
  const r = tema.renk;
  const cuzdan = useVeri(() => api.wallet(), []);
  useFocusEffect(useCallback(() => { cuzdan.reload(); }, [cuzdan.reload]));
  const w = cuzdan.data;
  const adet = w ? w.bookings.length + w.tickets.length + w.waitlist.length : 0;
  const durum = sahne(adet > 0 ? 'yerlerimDolu' : 'yerlerimBos');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: r.sis }} contentContainerStyle={{ paddingTop: ust + 14, paddingHorizontal: 16, paddingBottom: 32, gap: 22 }}>
      <View style={{ paddingHorizontal: 4 }}>
        <Baslik ince={t('yerlerim.baslikInce')} kalin={t('yerlerim.baslikKalin')} size={34} bitisik />
      </View>
      <Durum loading={cuzdan.loading && !w} error={cuzdan.error} onRetry={cuzdan.reload} />
      {w && <VuuDer hal={durum.hal} soz={durum.soz} boyut={84} />}
      {w && adet === 0 && <Dugme onPress={() => { secimiTemizle(); router.push({ pathname: '/ara', params: { odak: '1' } }); }}>{t('yerlerim.bul')}</Dugme>}

      {w?.bookings.map((b) => <RandevuSatiri key={b.id} b={b} yenile={cuzdan.reload} />)}
      {w?.tickets.map((x) => <BiletKarti key={x.id} b={x} />)}

      {w?.waitlist.map((x) => (
        <View key={x.id} style={{ padding: 18, borderRadius: tema.kose.kart, backgroundColor: r.sari, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 13, color: r.murekkep }}>{t('yerlerim.siraEtiket')}</Text>
            <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 13, color: r.murekkep }}>{x.status === 'offered' ? t('yerlerim.siraBosaldi') : t('yerlerim.siraNo', { n: x.position })}</Text>
          </View>
          <Text style={{ fontFamily: tema.yazi.metin, fontSize: 15, lineHeight: 21, color: r.murekkep }}>{t(x.status === 'offered' ? 'yerlerim.siraTeklif' : 'yerlerim.siraMetin', { isletme: x.provider, gun: tarih(x.start) })}</Text>
          {x.status === 'offered' && <Dugme tur="koyu" onPress={() => router.push({ pathname: '/isletme/[slug]', params: { slug: x.slug } })}>{t('yerlerim.siraGor')}</Dugme>}
        </View>
      ))}
    </ScrollView>
  );
}
