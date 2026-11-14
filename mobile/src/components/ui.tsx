// rande/VUU temel bileşenleri: yazı logosu, başlık, an pulu, an çizgisi, randevuu kartı, düğme.
// Hiçbirinde sabit renk ya da ölçü yoktur; hepsi config/tema.ts içinden okunur.

import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View, ViewStyle } from 'react-native';

import { tema } from '@/config';

const dokun = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

// ---------------------------------------------------------------- yazı logosu

export function Wordmark({ on = 'rande', size = 26, koyuZemin = false }: { on?: string; size?: number; koyuZemin?: boolean }) {
  const r = tema.renk;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="image" accessibilityLabel={`${on} VUU`}>
      <Text style={{ fontFamily: tema.yazi.ince, fontSize: size, lineHeight: size * 1.15, color: koyuZemin ? r.beyaz : r.murekkep }}>{on}</Text>
      <View style={{ width: Math.max(3, size * 0.15), height: size * 0.92, backgroundColor: r.sari, marginHorizontal: size * 0.2, transform: [{ skewX: tema.egim }] }} />
      <Text style={{ fontFamily: tema.yazi.kalin, fontSize: size, lineHeight: size * 1.15, color: r.mercan, transform: [{ skewX: tema.egim }] }}>VUU</Text>
    </View>
  );
}

/** İki ağırlıklı başlık: ilk yarı ince, ikinci yarı kalın. Logodaki karşıtlığın devamı. */
export function Baslik({ ince, kalin, size = 34, renk, altAlta = false, bitisik = false }: { ince: string; kalin: string; size?: number; renk?: string; altAlta?: boolean; bitisik?: boolean }) {
  return (
    <Text accessibilityRole="header" style={{ fontSize: size, lineHeight: size * 1.08, color: renk ?? tema.renk.murekkep, letterSpacing: -0.5 }}>
      <Text style={{ fontFamily: tema.yazi.ince }}>{ince}{altAlta ? '\n' : bitisik ? '' : ' '}</Text>
      <Text style={{ fontFamily: tema.yazi.kalin }}>{kalin}</Text>
    </Text>
  );
}

/** Bölüm başlığı: önünde logodaki küçük sarı çizgi. */
export function Bolum({ children, sag, koyuZemin = false }: { children: string; sag?: string; koyuZemin?: boolean }) {
  const r = tema.renk;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 }}>
        <View style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: r.sari, transform: [{ skewX: tema.egim }] }} />
        <Text accessibilityRole="header" style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: koyuZemin ? r.beyaz : r.murekkep, flexShrink: 1 }}>{children}</Text>
      </View>
      {!!sag && <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: koyuZemin ? r.lila : r.duman }}>{sag}</Text>}
    </View>
  );
}

/** Küçük etiket: kartların üstündeki "randevuun", "özel davet" gibi işaretler. */
export function Etiket({ children, renk = 'sari' }: { children: string; renk?: 'sari' | 'mercan' | 'onay' }) {
  const r = tema.renk;
  const zemin = renk === 'sari' ? r.sari : renk === 'onay' ? r.onay : r.mercanAcik;
  const yazi = renk === 'onay' ? r.beyaz : r.murekkep;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: zemin, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 12, color: yazi }}>{children}</Text>
    </View>
  );
}

/** Beyaz, zeminden hafifçe kalkan kart. */
export function Kart({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: tema.renk.beyaz, borderRadius: tema.kose.kart, padding: 18, boxShadow: tema.golge }, style]}>{children}</View>;
}

// ---------------------------------------------------------------- an pulu (ayırtılabilir saat)

export type PulDurum = 'bos' | 'secili' | 'dolu' | 'sonDakika';

export function AnPulu({ label, durum = 'bos', onPress, buyuk = false, zemin = 'sis', style }: { label: string; durum?: PulDurum; onPress?: () => void; buyuk?: boolean; zemin?: 'sis' | 'beyaz' | 'koyu'; style?: ViewStyle }) {
  const r = tema.renk;
  const olcek = useRef(new Animated.Value(1)).current;
  const bas = (to: number) => Animated.spring(olcek, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  const bosZemin = zemin === 'koyu' ? r.murekkep2 : zemin === 'beyaz' ? r.beyaz : r.sis;
  const arka = durum === 'secili' ? r.mercan : durum === 'sonDakika' ? r.sari : durum === 'dolu' ? 'transparent' : bosZemin;
  const yazi = durum === 'dolu' ? r.doluYazi : durum === 'bos' && zemin === 'koyu' ? r.beyaz : r.murekkep;
  return (
    <Pressable
      disabled={durum === 'dolu' || !onPress}
      onPressIn={() => bas(0.93)}
      onPressOut={() => bas(1)}
      onPress={() => { dokun(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: durum === 'secili', disabled: durum === 'dolu' }}
      accessibilityLabel={durum === 'dolu' ? `${label}, dolu` : label}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: olcek }], minHeight: buyuk ? 48 : 44, paddingHorizontal: buyuk ? 18 : 14, justifyContent: 'center', alignItems: 'center', backgroundColor: arka, borderRadius: tema.kose.pul }}>
        <Text style={{ fontFamily: durum === 'secili' ? tema.yazi.monoKalin : tema.yazi.mono, fontSize: buyuk ? 15 : 14, color: yazi, textDecorationLine: durum === 'dolu' ? 'line-through' : 'none' }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Seçenek pulu: zaman pencereleri gibi yazılı seçenekler için (saat değil, kelime). */
export function SecenekPulu({ label, secili, onPress, koyuZemin = false }: { label: string; secili: boolean; onPress: () => void; koyuZemin?: boolean }) {
  const r = tema.renk;
  const olcek = useRef(new Animated.Value(1)).current;
  const bas = (to: number) => Animated.spring(olcek, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable onPressIn={() => bas(0.94)} onPressOut={() => bas(1)} onPress={() => { dokun(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: secili }}>
      <Animated.View style={{ transform: [{ scale: olcek }], minHeight: 46, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 999, backgroundColor: secili ? r.mercan : koyuZemin ? r.murekkep2 : r.beyaz }}>
        <Text style={{ fontFamily: secili ? tema.yazi.metinKalin : tema.yazi.metinOrta, fontSize: 15, color: secili ? r.murekkep : koyuZemin ? r.beyaz : r.murekkep }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- an çizgisi (günün doluluğu)

/** Bir günün doluluğu tek satırda: mercan dilim boş an, soluk dilim dolu, koyu dilim senin seçimin. */
export function AnCizgisi({ strip, secili, koyuZemin = false, saatler = false, yukseklik }: { strip: boolean[]; secili?: number; koyuZemin?: boolean; saatler?: boolean; yukseklik?: number }) {
  const r = tema.renk;
  const h = yukseklik ?? tema.an.yukseklik;
  const anim = useMemo(() => strip.map(() => new Animated.Value(tema.hareket.acik ? 0 : 1)), [strip.length]);
  const imza = strip.join('');
  useEffect(() => {
    if (!tema.hareket.acik) return;
    anim.forEach((a) => a.setValue(0));
    Animated.stagger(14, anim.map((a) => Animated.timing(a, { toValue: 1, duration: 220, useNativeDriver: true }))).start();
  }, [anim, imza]);
  const bos = strip.filter(Boolean).length;
  return (
    <View accessibilityRole="image" accessibilityLabel={`${strip.length} dilimin ${bos} tanesi boş`}>
      <View style={{ flexDirection: 'row', gap: tema.an.bosluk }}>
        {strip.map((free, i) => {
          const renk = i === secili ? (koyuZemin ? r.sari : r.murekkep) : free ? r.mercan : koyuZemin ? r.murekkep3 : r.dolu;
          return <Animated.View key={i} style={{ flex: 1, height: h, borderRadius: h / 2, backgroundColor: renk, opacity: anim[i] }} />;
        })}
      </View>
      {saatler && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {['09', '11', '13', '15', '17', '19'].map((s) => (
            <Text key={s} style={{ fontFamily: tema.yazi.mono, fontSize: 11, color: koyuZemin ? r.lila : r.duman }}>{s}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** Kontenjan çizgisi: gelenler koyu, senin biletlerin mercan, boş yerler soluk. */
export function KontenjanCizgisi({ kapasite, dolu, senin = 0 }: { kapasite: number; dolu: number; senin?: number }) {
  const r = tema.renk;
  const dilim = Math.min(kapasite, 24);
  const oran = dilim / kapasite;
  const d = Math.round(dolu * oran);
  const s = senin ? Math.max(1, Math.round(senin * oran)) : 0;
  return (
    <View style={{ flexDirection: 'row', gap: 5 }} accessibilityRole="image" accessibilityLabel={`${kapasite} kişilik yerin ${dolu} tanesi dolu`}>
      {Array.from({ length: dilim }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: i < d ? r.murekkep : i < d + s ? r.mercan : r.dolu }} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- randevuu kartı (bilet biçiminde)

function Kesik({ renk }: { renk: string }) {
  // Yırtma çizgisi: RN'de tek kenarlı kesikli kenarlık güvenilir olmadığından küçük parçalarla çizilir.
  return (
    <View style={{ height: 2, marginHorizontal: 18, flexDirection: 'row', overflow: 'hidden' }}>
      {Array.from({ length: 44 }, (_, i) => <View key={i} style={{ width: 6, height: 2, borderRadius: 1, marginRight: 5, backgroundColor: renk }} />)}
    </View>
  );
}

/**
 * "randevuun": randevu da bilet de aynı kart. Üstte içerik, yırtma çizgisinin altında kod ya da eylem.
 * `zemin` sayfanın rengi olmalıdır: iki yandaki çentikler o renkle oyulur.
 */
export function RandevuuKarti({ children, alt, koyu = true, zemin, style }: { children: React.ReactNode; alt?: React.ReactNode; koyu?: boolean; zemin?: string; style?: ViewStyle }) {
  const r = tema.renk;
  const centik = { position: 'absolute' as const, width: 22, height: 22, borderRadius: 11, backgroundColor: zemin ?? r.sis, top: -10 };
  return (
    <View style={[{ backgroundColor: koyu ? r.murekkep : r.beyaz, borderRadius: tema.kose.kart, boxShadow: koyu ? tema.golgeGuclu : tema.golge }, style]}>
      <View style={{ padding: 20 }}>{children}</View>
      {alt && (
        <>
          <View>
            <Kesik renk={koyu ? r.murekkep3 : r.cizgi} />
            <View style={[centik, { left: -11 }]} />
            <View style={[centik, { right: -11 }]} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>{alt}</View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- düğme

export function Dugme({ children, onPress, tur = 'ana', disabled = false, style }: { children: string; onPress?: () => void; tur?: 'ana' | 'cizgi' | 'koyu' | 'sakin'; disabled?: boolean; style?: ViewStyle }) {
  const r = tema.renk;
  const olcek = useRef(new Animated.Value(1)).current;
  const bas = (to: number) => Animated.spring(olcek, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const zemin = disabled ? r.dolu : tur === 'ana' ? r.mercan : tur === 'koyu' ? r.murekkep : tur === 'sakin' ? r.sis : r.beyaz;
  const yazi = disabled ? r.duman : tur === 'koyu' ? r.beyaz : r.murekkep;
  return (
    <Pressable disabled={disabled} onPressIn={() => bas(0.97)} onPressOut={() => bas(1)} onPress={() => { dokun(); onPress?.(); }} accessibilityRole="button" accessibilityState={{ disabled }} style={style}>
      <Animated.View style={[{ minHeight: 56, borderRadius: tema.kose.dugme, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: zemin, transform: [{ scale: olcek }] }, tur === 'ana' && !disabled && { boxShadow: '0px 8px 20px rgba(255, 90, 78, 0.35)' }, tur === 'cizgi' && !disabled && { borderWidth: 2, borderColor: r.murekkep }]}>
        <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: yazi }}>{children}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Geri düğmesi. */
export function Geri({ onPress, koyuZemin = false, label }: { onPress: () => void; koyuZemin?: boolean; label: string }) {
  const r = tema.renk;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: koyuZemin ? r.murekkep2 : r.beyaz, alignItems: 'center', justifyContent: 'center', boxShadow: koyuZemin ? 'none' : tema.golge }}>
      <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 18, color: koyuZemin ? r.beyaz : r.murekkep }}>←</Text>
    </Pressable>
  );
}
