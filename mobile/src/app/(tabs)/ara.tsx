// Ara: kullanıcı ne lazımsa yazar ("manikür yarın akşam"). Ekranın üç hali var:
//   göz at  · kutu boş, henüz bir şey seçilmedi: son aramalar ve alfabetik hizmet listesi
//   öneri   · yazılıyor: hizmet alanı, hizmet ve işletme önerileri; cümledeki zaman ayrıca yakalanır
//   sonuç   · bir şey seçildi: zaman seçici ve en erken boş ana göre sıralı yerler

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, Oneri, pencereler, zamanAyikla } from '@/api';
import { Buyutec, Durum, SonucKarti, ZamanSecici } from '@/components/kartlar';
import { VuuDer } from '@/components/Maskot';
import { Bolum, Dugme, Kart, SecenekPulu } from '@/components/ui';
import { metinler, sahne, t, tema } from '@/config';
import { secimiAyarla, secimiTemizle, sonAramaEkle, useSecim, useSonAramalar, useVeri } from '@/state';

const BOS = { suggestions: [] as Oneri[] };

function OneriSatiri({ o, onPress }: { o: Oneri; onPress: () => void }) {
  const r = tema.renk;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: pressed ? r.sis : r.beyaz })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: r.murekkep }}>{o.etiket}</Text>
        {!!o.alt && <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{o.alt}</Text>}
      </View>
      <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 12, color: r.duman }}>{(metinler.arama.tur as Record<string, string>)[o.tur]}</Text>
    </Pressable>
  );
}

export default function Ara() {
  const ust = useSafeAreaInsets().top;
  const r = tema.renk;
  const { odak } = useLocalSearchParams<{ odak?: string }>();
  const { alan, hizmet, etiket, pencere } = useSecim();
  const sonlar = useSonAramalar();
  const kutu = useRef<TextInputInstance>(null);
  const [yazi, setYazi] = useState('');

  // Ana sayfadaki arama kutusundan gelindiyse klavye açık başlar.
  useEffect(() => {
    if (odak === '1') setTimeout(() => kutu.current?.focus(), 250);
  }, [odak]);

  // Yazılanın içindeki zaman ("yarın akşam") ayrılır; geri kalanı öneriye gider. Her tuşta değil, kısa bir duraksamada sorulur.
  const ayik = useMemo(() => zamanAyikla(yazi), [yazi]);
  const [sorgu, setSorgu] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSorgu(ayik.kalan), 180);
    return () => clearTimeout(id);
  }, [ayik.kalan]);
  const oneriler = useVeri(() => (sorgu ? api.suggest(sorgu) : Promise.resolve(BOS)), [sorgu]);
  const kategoriler = useVeri(() => api.categories(), []);

  const liste = useMemo(() => pencereler(), []);
  const p = liste.find((x) => x.id === pencere) ?? liste[liste.length - 1];
  const arama = useVeri(() => (alan ? api.search(alan, p.start, p.end, hizmet) : Promise.resolve(null)), [alan, hizmet, p.id]);

  const sec = (o: Oneri) => {
    Keyboard.dismiss();
    if (ayik.pencere) secimiAyarla({ pencere: ayik.pencere });
    if (o.tur === 'isletme' && o.slug) {
      router.push({ pathname: '/isletme/[slug]', params: { slug: o.slug } });
      return;
    }
    secimiAyarla({ alan: o.alan, hizmet: o.hizmet, etiket: o.etiket });
    sonAramaEkle({ etiket: o.etiket, alan: o.alan, hizmet: o.hizmet });
    setYazi('');
  };
  const gonder = () => {
    const ilk = oneriler.data?.suggestions[0];
    if (ilk && sorgu === ayik.kalan) sec(ilk);
    else if (ayik.pencere && !ayik.kalan) { secimiAyarla({ pencere: ayik.pencere }); setYazi(''); Keyboard.dismiss(); }
  };
  const temizle = () => { setYazi(''); secimiTemizle(); kutu.current?.focus(); };

  const hal: 'gozat' | 'oneri' | 'sonuc' = yazi.trim() ? 'oneri' : alan ? 'sonuc' : 'gozat';
  const sonuclar = arama.data?.results ?? [];
  const pencereAdi = ayik.pencere ? (metinler.pencere as Record<string, string>)[ayik.pencere] : undefined;
  const vuu = arama.loading ? sahne('araniyor')
    : arama.error ? { ...sahne('hata'), soz: `${sahne('hata').soz} ${arama.error}` }
    : sonuclar.length === 0 ? sahne('bulunamadi')
    : sonuclar.length === 1 ? sahne('bulunduTek') : sahne('bulundu', { n: sonuclar.length });

  return (
    <View style={{ flex: 1, backgroundColor: r.sis }}>
      {/* arama kutusu */}
      <View style={{ paddingTop: ust + 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: r.sis }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, paddingHorizontal: 16, borderRadius: 20, backgroundColor: r.beyaz, boxShadow: tema.golge }}>
          <Buyutec />
          <TextInput
            ref={kutu}
            value={yazi}
            onChangeText={setYazi}
            onSubmitEditing={gonder}
            placeholder={hal === 'sonuc' && etiket ? etiket : t('arama.kutu')}
            placeholderTextColor={hal === 'sonuc' ? r.murekkep : r.duman}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={t('arama.kutu')}
            style={{ flex: 1, fontFamily: hal === 'sonuc' && !yazi ? tema.yazi.metinKalin : tema.yazi.metinOrta, fontSize: 17, color: r.murekkep, paddingVertical: 12, outlineStyle: 'none' } as object}
          />
          {(!!yazi || !!alan) && (
            <Pressable onPress={temizle} accessibilityRole="button" accessibilityLabel={t('arama.temizle')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: r.sis, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: r.duman }}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
        {hal === 'oneri' && (
          <>
            {pencereAdi && (
              <View style={{ alignSelf: 'flex-start', backgroundColor: r.sari, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 13, color: r.murekkep }}>{t('arama.zamanEtiketi', { pencere: pencereAdi })}</Text>
              </View>
            )}
            {(oneriler.data?.suggestions.length ?? 0) > 0 && (
              <View style={{ borderRadius: tema.kose.kart, overflow: 'hidden', backgroundColor: r.beyaz, boxShadow: tema.golge }}>
                {oneriler.data!.suggestions.map((o, i) => (
                  <View key={`${o.tur}-${o.etiket}-${o.slug ?? o.alan}`} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: r.cizgi }}>
                    <OneriSatiri o={o} onPress={() => sec(o)} />
                  </View>
                ))}
              </View>
            )}
            {!!sorgu && !oneriler.loading && !oneriler.error && oneriler.data?.suggestions.length === 0 && (
              <VuuDer hal={sahne('oneriYok').hal} soz={sahne('oneriYok').soz} boyut={84} />
            )}
          </>
        )}

        {hal === 'gozat' && (
          <>
            <VuuDer hal={sahne('gozAt').hal} soz={sahne('gozAt').soz} boyut={84} />
            {sonlar.length > 0 && (
              <>
                <View style={{ paddingHorizontal: 4 }}><Bolum>{t('arama.son')}</Bolum></View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {sonlar.map((s) => (
                    <SecenekPulu key={s.alan + (s.hizmet ?? '')} label={s.etiket} secili={false} onPress={() => secimiAyarla({ alan: s.alan, hizmet: s.hizmet, etiket: s.etiket })} />
                  ))}
                </View>
              </>
            )}
            <View style={{ paddingHorizontal: 4, marginTop: 4 }}><Bolum>{t('arama.hizmetler')}</Bolum></View>
            <Durum loading={kategoriler.loading && !kategoriler.data} error={kategoriler.error} onRetry={kategoriler.reload} />
            {kategoriler.data && (
              <Kart style={{ padding: 0, overflow: 'hidden' }}>
                {kategoriler.data.categories.map((k, i) => (
                  <Pressable key={k.id} onPress={() => sec({ tur: 'alan', etiket: k.ad, alt: '', alan: k.id })} accessibilityRole="button"
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 18, borderTopWidth: i ? 1 : 0, borderTopColor: r.cizgi, backgroundColor: pressed ? r.sis : r.beyaz })}>
                    <Text style={{ flex: 1, fontFamily: tema.yazi.metinOrta, fontSize: 16, color: r.murekkep }}>{k.ad}</Text>
                    <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman, marginRight: 10 }}>{t('arama.alanAdet', { n: k.adet })}</Text>
                    <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 18, color: r.duman }}>›</Text>
                  </Pressable>
                ))}
              </Kart>
            )}
          </>
        )}

        {hal === 'sonuc' && (
          <>
            <View style={{ paddingHorizontal: 4 }}><Bolum>{t('ara.zaman')}</Bolum></View>
            <View style={{ marginHorizontal: -16 }}><ZamanSecici liste={liste} secili={p.id} /></View>
            <VuuDer hal={vuu.hal} soz={vuu.soz} boyut={78} />
            {!arama.loading && sonuclar.length === 0 && p.id !== 'hafta' && <Dugme tur="cizgi" onPress={() => secimiAyarla({ pencere: 'hafta' })}>{t('ara.genislet')}</Dugme>}
            {arama.error && <Dugme tur="cizgi" onPress={arama.reload}>{t('genel.tekrar')}</Dugme>}
            {sonuclar.length > 0 && (
              <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman, paddingHorizontal: 4 }}>{t('ara.sonuc', { n: sonuclar.length, sehir: metinler.marka.sehir })}</Text>
            )}
            {sonuclar.map((s) => <SonucKarti key={s.provider.slug} r={s} saatler />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}
