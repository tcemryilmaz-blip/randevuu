// Keşfet: hiçbir hizmet alanı dayatılmaz. Kullanıcı ne lazımsa yazar; altta yalnızca ona ait şeyler durur:
// sıradaki randevuun, kaldığı aramalar ve yakındaki etkinlikler.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, saat, tarih } from '@/api';
import { Buyutec, EtkinlikKarti } from '@/components/kartlar';
import { Maskot } from '@/components/Maskot';
import { MiniAjanda } from '@/components/randevuun';
import { Baslik, Bolum, Dugme, SecenekPulu, Wordmark } from '@/components/ui';
import { metinler, sahne, t, tema } from '@/config';
import { secimiAyarla, secimiTemizle, useSonAramalar, useVeri } from '@/state';

/** Arama kutusu görünümünde düğme: dokununca Ara ekranı klavyesi açık gelir. Örnekler sırayla döner. */
function AramaKutusu() {
  const r = tema.renk;
  const ornekler = metinler.arama.ornekler;
  const [i, setI] = useState(0);
  const sol = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!tema.hareket.acik || ornekler.length < 2) return;
    const id = setInterval(() => {
      Animated.timing(sol, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % ornekler.length);
        Animated.timing(sol, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, 2600);
    return () => clearInterval(id);
  }, [ornekler.length, sol]);
  return (
    <Pressable
      onPress={() => { secimiTemizle(); router.push({ pathname: '/ara', params: { odak: '1' } }); }}
      accessibilityRole="search"
      accessibilityLabel={t('arama.kutu')}
      style={{ marginHorizontal: 20, minHeight: 62, borderRadius: 20, backgroundColor: r.beyaz, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12, boxShadow: tema.golgeGuclu }}
    >
      <Buyutec />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: r.murekkep }}>{t('arama.kutu')}</Text>
        <Animated.Text numberOfLines={1} style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman, opacity: sol }}>{ornekler[i]}</Animated.Text>
      </View>
    </Pressable>
  );
}

export default function Kesfet() {
  const ust = useSafeAreaInsets().top;
  const r = tema.renk;
  const sonlar = useSonAramalar();
  const cuzdan = useVeri(() => api.wallet(), []);
  useFocusEffect(useCallback(() => { cuzdan.reload(); }, [cuzdan.reload]));
  const etkinlik = useVeri(() => api.events(), []);
  const kay = useRef(new Animated.Value(0)).current;

  // İlk açılışta Vuu kendini tanıtır.
  useEffect(() => {
    AsyncStorage.getItem('tanisma-goruldu').then((v) => { if (!v) router.push('/tanisma'); }).catch(() => {});
  }, []);

  const siradaki = cuzdan.data?.bookings[0];
  const vuu = siradaki
    ? sahne('siradaki', { gun: tarih(siradaki.start), saat: saat(siradaki.start), isletme: siradaki.provider.name })
    : sahne('karsilama');

  return (
    <View style={{ flex: 1, backgroundColor: r.murekkep }}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: kay } } }], { useNativeDriver: true })}
      >
        {/* Arka sahne */}
        <View style={{ paddingTop: ust + 14, paddingBottom: 58 }}>
          <Animated.View style={{ position: 'absolute', right: -70, top: ust + 30, width: 250, height: 250, borderRadius: 125, backgroundColor: r.murekkep2, transform: [{ translateY: kay.interpolate({ inputRange: [0, 300], outputRange: [0, 70], extrapolate: 'clamp' }) }] }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 }}>
            <Wordmark koyuZemin size={24} />
            <View style={{ backgroundColor: r.murekkep2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 13, color: r.beyaz }}>{metinler.marka.sehir}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 24, marginTop: 22 }}>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Baslik ince={t('kesfet.baslikInce')} kalin={t('kesfet.baslikKalin')} size={38} renk={r.beyaz} altAlta />
            </View>
            <Animated.View style={{ marginRight: 10, transform: [{ translateY: kay.interpolate({ inputRange: [0, 300], outputRange: [0, 24], extrapolate: 'clamp' }) }] }}>
              <Maskot hal={vuu.hal} boyut={150} />
            </Animated.View>
          </View>

          <View style={{ marginHorizontal: 24, marginTop: 2, marginBottom: 18, alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: r.murekkep2, borderRadius: 18, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 15, lineHeight: 21, color: r.beyaz }}>{vuu.soz}</Text>
          </View>

          <AramaKutusu />
        </View>

        {/* Ön sayfa */}
        <View style={{ backgroundColor: r.sis, borderTopLeftRadius: tema.kose.sayfa, borderTopRightRadius: tema.kose.sayfa, marginTop: -30, paddingTop: 24, paddingBottom: 36, paddingHorizontal: 16, gap: 14, minHeight: 460, boxShadow: '0px -12px 30px rgba(0, 0, 0, 0.25)' }}>
          {siradaki && (
            <>
              <View style={{ paddingHorizontal: 4 }}><Bolum>{t('kesfet.siradaki')}</Bolum></View>
              <Pressable onPress={() => router.push('/cuzdan')} accessibilityRole="button"><MiniAjanda b={siradaki} /></Pressable>
            </>
          )}

          {sonlar.length > 0 && (
            <>
              <View style={{ paddingHorizontal: 4, marginTop: siradaki ? 8 : 0 }}><Bolum>{t('kesfet.son')}</Bolum></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {sonlar.map((s) => (
                  <SecenekPulu key={s.alan + (s.hizmet ?? '')} label={s.etiket} secili={false}
                    onPress={() => { secimiAyarla({ alan: s.alan, hizmet: s.hizmet, etiket: s.etiket }); router.push('/ara'); }} />
                ))}
              </View>
            </>
          )}

          {(etkinlik.data?.events.length ?? 0) > 0 && (
            <>
              <View style={{ paddingHorizontal: 4, marginTop: 8 }}><Bolum>{t('kesfet.yakinda')}</Bolum></View>
              {etkinlik.data!.events.map((e) => <EtkinlikKarti key={e.id} e={e} />)}
            </>
          )}

          <Dugme tur="cizgi" style={{ marginTop: 8 }} onPress={() => { secimiTemizle(); router.push('/ara'); }}>{t('kesfet.gozAt')}</Dugme>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
