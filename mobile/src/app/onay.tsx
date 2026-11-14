// Son bakış ve ön ödeme. Ödeme başarılı olunca ekran mercana döner, ajanda yaprağı yukarıdan iner
// ve Vuu "yerini ısıttım" der.

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError, Booking, para, saat, tarih } from '@/api';
import { Durum } from '@/components/kartlar';
import { VuuDer } from '@/components/Maskot';
import { AjandaKarti } from '@/components/randevuun';
import { Baslik, Dugme, Etiket, Geri, Kart, RandevuuKarti } from '@/components/ui';
import { sahne, t, tema } from '@/config';
import { useVeri } from '@/state';

function OnayKutusu({ secili, onPress, children }: { secili: boolean; onPress: () => void; children: React.ReactNode }) {
  const r = tema.renk;
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: secili }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44 }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: secili ? r.mercan : r.duman, backgroundColor: secili ? r.mercan : r.beyaz, alignItems: 'center', justifyContent: 'center' }}>
        {secili && <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 14, lineHeight: 18, color: r.murekkep }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, fontFamily: tema.yazi.metin, fontSize: 14, lineHeight: 20, color: r.murekkep }}>{children}</Text>
    </Pressable>
  );
}

function Basarili({ b }: { b: Booking }) {
  const insets = useSafeAreaInsets();
  const r = tema.renk;
  const dus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(dus, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 110, mass: 0.9 }).start();
  }, [dus]);
  const vuu = sahne('yerHazir');
  const odeme = b.deposit_paid > 0
    ? t('basari.onOdemeli', { onOdeme: para(b.deposit_paid), kalan: para(b.price - b.deposit_paid) })
    : t('basari.onOdemesiz', { tutar: para(b.price) });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: r.mercan }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 8, gap: 22 }}>
      <Baslik ince={t('basari.baslikInce')} kalin={t('basari.baslikKalin')} size={44} altAlta />
      {/* ajanda yaprağı yukarıdan iner ve hafif eğik durur */}
      <Animated.View style={{ opacity: dus, transform: [{ translateY: dus.interpolate({ inputRange: [0, 1], outputRange: [-280, 0] }) }, { rotate: dus.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-1.5deg'] }) }] }}>
        <AjandaKarti b={b} qrBoyut={168} />
      </Animated.View>
      <VuuDer hal={vuu.hal} soz={`${vuu.soz} ${odeme} ${t('basari.hatirlatma')}`} boyut={92} arka={r.beyaz} />
      <Dugme tur="koyu" onPress={() => router.replace('/cuzdan')}>{t('basari.git')}</Dugme>
    </ScrollView>
  );
}

export default function OnayEkrani() {
  const { slug, serviceId, start } = useLocalSearchParams<{ slug: string; serviceId: string; start: string }>();
  const insets = useSafeAreaInsets();
  const r = tema.renk;
  const isletme = useVeri(() => api.provider(slug), [slug]);
  const [riza, setRiza] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<{ durum: number; mesaj: string } | null>(null);
  const [sonuc, setSonuc] = useState<Booking | null>(null);

  if (sonuc) return <Basarili b={sonuc} />;

  const p = isletme.data?.provider;
  const hizmet = isletme.data?.services.find((s) => s.id === serviceId);
  const rizaGerekli = !!p?.needs_health_consent;
  const hazir = !!p && !!hizmet && (!rizaGerekli || riza);
  const sonIptal = p ? new Date(new Date(start).getTime() - p.cancel_hours * 3600000).toISOString() : start;

  const tut = async () => {
    setGonderiliyor(true);
    setHata(null);
    try {
      setSonuc(await api.book({ provider_slug: slug, service_id: serviceId, start, consent_health: riza }));
    } catch (e) {
      setHata(e instanceof ApiError ? { durum: e.status, mesaj: e.message } : { durum: 0, mesaj: t('genel.ulasilamadi') });
    } finally {
      setGonderiliyor(false);
    }
  };

  const vuu = hata ? (hata.durum === 409 ? sahne('doldu') : { ...sahne('hata'), soz: `${sahne('hata').soz} ${hata.mesaj}` }) : sahne('onay');

  return (
    <View style={{ flex: 1, backgroundColor: r.sis }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 }}>
          <Geri onPress={() => router.back()} label={t('genel.geri')} />
          <Baslik ince={t('onay.baslikInce')} kalin={t('onay.baslikKalin')} size={28} />
        </View>
        <Durum loading={isletme.loading && !isletme.data} error={isletme.error} onRetry={isletme.reload} />

        {p && hizmet && (
          <>
            <RandevuuKarti alt={
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 15, color: r.beyaz }}>{t(p.deposit_amount > 0 ? 'onay.onOdeme' : 'onay.simdi')}</Text>
                  <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 15, color: r.sari }}>{p.deposit_amount > 0 ? para(p.deposit_amount) : '0₺'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, color: r.lila }}>{t('onay.kalan')}</Text>
                  <Text style={{ fontFamily: tema.yazi.mono, fontSize: 14, color: r.lila }}>{para(hizmet.price - p.deposit_amount)}</Text>
                </View>
              </View>
            }>
              <Etiket>{t('randevuun.etiket')}</Etiket>
              <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 26, color: r.beyaz, marginTop: 12 }}>{tarih(start)} · {saat(start)}</Text>
              <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 15, color: r.beyaz, marginTop: 6 }}>{p.name} · {hizmet.name} · {t('isletme.dakika', { n: hizmet.duration_min })}</Text>
              <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.lila, marginTop: 2 }}>{p.address}</Text>
            </RandevuuKarti>

            {(p.deposit_amount > 0 || rizaGerekli) && (
              <Kart style={{ gap: 14 }}>
                {p.deposit_amount > 0 && (
                  <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, lineHeight: 20, color: r.duman }}>
                    <Text style={{ fontFamily: tema.yazi.metinKalin, color: r.murekkep }}>{t('onay.iptalBaslik')}</Text>
                    {t('onay.iptalMetin', { zaman: `${tarih(sonIptal)} ${saat(sonIptal)}` })}
                  </Text>
                )}
                {rizaGerekli && <OnayKutusu secili={riza} onPress={() => setRiza(!riza)}>{t('onay.riza')}</OnayKutusu>}
              </Kart>
            )}

            <VuuDer hal={vuu.hal} soz={vuu.soz} boyut={84} />
            {hata?.durum === 409 && <Dugme tur="koyu" onPress={() => router.back()}>{t('onay.baskaAn')}</Dugme>}
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: r.beyaz, borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0px -8px 24px rgba(23, 19, 43, 0.08)', gap: 8 }}>
        <Dugme disabled={!hazir || gonderiliyor} onPress={tut}>
          {gonderiliyor ? t('onay.gonderiliyor') : !p || !hizmet ? t('onay.yukleniyor') : rizaGerekli && !riza ? t('onay.rizaEksik') : p.deposit_amount > 0 ? t('onay.ode', { tutar: para(p.deposit_amount) }) : t('onay.tut')}
        </Dugme>
        <Text style={{ fontFamily: tema.yazi.metin, fontSize: 12, color: r.duman, textAlign: 'center' }}>{t('onay.gelistirme')}</Text>
      </View>
    </View>
  );
}
