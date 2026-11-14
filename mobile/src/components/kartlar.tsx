// Ekranların ortak parçaları: alan ve zaman seçiciler, sonuç kartı, etkinlik kartı, durum kutusu.

import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { ayniGun, EventItem, para, Pencere, saat, SearchResult, seritSirasi, tarih } from '@/api';
import { sahne, Sahne, t, tema } from '@/config';
import { secimiAyarla } from '@/state';

import { VuuDer } from './Maskot';
import { AnCizgisi, AnPulu, Dugme, Etiket, Kart, RandevuuKarti } from './ui';

/** "Ne zaman olsun?": sade yazı sekmeleri, seçili olanın altında sarı çizgi. */
export function ZamanSecici({ liste, secili }: { liste: Pencere[]; secili: string }) {
  const r = tema.renk;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}>
      {liste.filter((p) => !p.gizli || p.id === secili).map((p) => {
        const aktif = p.id === secili;
        return (
          <Pressable key={p.id} onPress={() => secimiAyarla({ pencere: p.id })} accessibilityRole="button" accessibilityState={{ selected: aktif }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ fontFamily: aktif ? tema.yazi.metinKalin : tema.yazi.metinOrta, fontSize: 15, color: aktif ? r.murekkep : r.duman }}>{p.ad}</Text>
            <View style={{ height: 4, borderRadius: 2, marginTop: 5, backgroundColor: aktif ? r.sari : 'transparent' }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Çizginin gösterdiği gündeki anlar yalın yazılır; başka güne düşenler gün adıyla ("Çar 15:15").
const anEtiketi = (iso: string, cizgiGunu: string) => (ayniGun(iso, cizgiGunu) ? saat(iso) : `${tarih(iso).split(' ')[0]} ${saat(iso)}`);

export function SonucKarti({ r, saatler = false }: { r: SearchResult; saatler?: boolean }) {
  const c = tema.renk;
  const git = (start?: string) => router.push({ pathname: '/isletme/[slug]', params: { slug: r.provider.slug, start: start ?? r.slots[0] } });
  const cizgiGunu = r.strip_day + 'T12:00:00+03:00';
  return (
    <Pressable onPress={() => git()} accessibilityRole="button" accessibilityLabel={`${r.provider.name}, en erken ${tarih(r.slots[0])} ${saat(r.slots[0])}`}>
      <Kart style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 18, color: c.murekkep }}>{r.provider.name}</Text>
            <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, color: c.duman, marginTop: 2 }}>{r.service.name} · {t('isletme.dakika', { n: r.service.duration_min })}</Text>
          </View>
          <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 15, color: c.murekkep }}>{para(r.service.price)}</Text>
        </View>
        <View style={{ gap: 6 }}>
          <AnCizgisi strip={r.strip} secili={seritSirasi(r.slots[0])} saatler={saatler} />
          <Text style={{ fontFamily: tema.yazi.metin, fontSize: 12, color: c.duman }}>{t('kart.bosAn', { gun: tarih(cizgiGunu), n: r.strip.filter(Boolean).length })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {r.slots.slice(0, tema.an.kartta).map((s, i) => (
            <AnPulu key={s} label={anEtiketi(s, cizgiGunu)} durum={i === 0 ? 'secili' : 'bos'} onPress={() => git(s)} />
          ))}
        </View>
      </Kart>
    </Pressable>
  );
}

export function EtkinlikKarti({ e }: { e: EventItem }) {
  const c = tema.renk;
  const kalan = e.capacity - e.sold;
  return (
    <Pressable onPress={() => router.push({ pathname: '/etkinlik/[slug]', params: { slug: e.slug } })} accessibilityRole="button" accessibilityLabel={`${e.title}, ${kalan} yer kaldı`}>
      <RandevuuKarti alt={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 14, color: kalan <= 4 ? c.sari : c.lila }}>{kalan > 0 ? t('kart.yerKaldi', { n: kalan }) : t('kart.tukendi')}</Text>
          <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 16, color: c.sari }}>{para(e.price)}</Text>
        </View>
      }>
        <Text style={{ fontFamily: tema.yazi.baslik, fontSize: 20, color: c.beyaz }}>{e.title}</Text>
        <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 14, color: c.lila, marginTop: 6 }}>{tarih(e.start)} · {saat(e.start)} · {e.place}</Text>
      </RandevuuKarti>
    </Pressable>
  );
}

/** Yükleniyor / hata / boş durumları. Boş ve hata durumlarını Vuu anlatır. */
export function Durum({ loading, error, bos, onRetry, koyuZemin = false }: { loading?: boolean; error?: string | null; bos?: Sahne; onRetry?: () => void; koyuZemin?: boolean }) {
  if (loading) return <View style={{ padding: 28, alignItems: 'center' }}><ActivityIndicator color={tema.renk.mercan} /></View>;
  if (error) {
    const s = sahne('hata');
    return (
      <View style={{ gap: 12 }}>
        <VuuDer hal={s.hal} soz={`${s.soz} ${error}`} koyuZemin={koyuZemin} />
        {onRetry && <Dugme tur={koyuZemin ? 'ana' : 'cizgi'} onPress={onRetry}>{t('genel.tekrar')}</Dugme>}
      </View>
    );
  }
  if (bos) {
    const s = sahne(bos);
    return <VuuDer hal={s.hal} soz={s.soz} koyuZemin={koyuZemin} />;
  }
  return null;
}

export { Etiket };

/** Büyüteç: arama kutusunun simgesi. */
export function Buyutec({ boyut = 22, renk }: { boyut?: number; renk?: string }) {
  return (
    <Svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke={renk ?? tema.renk.murekkep} strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} />
    </Svg>
  );
}
