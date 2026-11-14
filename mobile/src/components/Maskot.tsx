// Vuu: mahallenin kedisi. Kuyruğu logodaki sarı çizgidir, tasması da.
// Çizim tamamen vektördür; renkler temadan gelir, haller config/maskot.ts içinde tanımlıdır.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { maskot, MaskotHal, tema } from '@/config';

function Gozler({ hal, kapali }: { hal: MaskotHal; kapali: boolean }) {
  const m = tema.renk.murekkep;
  if (hal === 'uyku' || kapali) {
    // kapalı göz: aşağı bakan yay
    return (
      <G stroke={m} strokeWidth={4} strokeLinecap="round" fill="none">
        <Path d="M69 79 Q78 86 87 79" />
        <Path d="M113 79 Q122 86 131 79" />
      </G>
    );
  }
  if (hal === 'mutlu') {
    // gülen göz: yukarı bakan yay
    return (
      <G stroke={m} strokeWidth={4.5} strokeLinecap="round" fill="none">
        <Path d="M69 82 Q78 70 87 82" />
        <Path d="M113 82 Q122 70 131 82" />
      </G>
    );
  }
  const buyuk = hal === 'nobet';
  const kay = hal === 'arama' ? 3 : 0; // etrafı tararken gözbebekleri yana kayar
  return (
    <G>
      <Ellipse cx={78 + kay} cy={79} rx={buyuk ? 9 : 7} ry={buyuk ? 11 : 9} fill={m} />
      <Ellipse cx={122 + kay} cy={79} rx={buyuk ? 9 : 7} ry={buyuk ? 11 : 9} fill={m} />
      <Circle cx={81 + kay} cy={75} r={buyuk ? 3.2 : 2.6} fill={tema.renk.beyaz} />
      <Circle cx={125 + kay} cy={75} r={buyuk ? 3.2 : 2.6} fill={tema.renk.beyaz} />
      {hal === 'uzgun' && (
        <G stroke={m} strokeWidth={3} strokeLinecap="round">
          <Line x1={68} y1={64} x2={86} y2={68} />
          <Line x1={132} y1={64} x2={114} y2={68} />
        </G>
      )}
    </G>
  );
}

// Kuyruğun her haldeki biçimi. Kök (120,182) gövdenin içinde kalır, böylece kuyruk gövdeden çıkıyormuş gibi görünür.
const KUYRUK: Record<MaskotHal, string> = {
  merhaba: 'M120 182 C148 192 176 184 178 158 C180 134 166 118 174 100',
  arama: 'M120 182 C148 192 176 184 178 158 C180 134 166 118 174 100',
  mutlu: 'M120 182 C150 190 180 180 182 152 C184 128 172 112 182 96',
  nobet: 'M120 182 C146 188 166 176 168 148 C170 120 166 94 174 72',   // dik ve uyanık
  uyku: 'M120 186 C146 196 176 194 182 180 C186 168 176 160 166 166',  // önüne dolanmış
  uzgun: 'M120 186 C146 192 168 194 188 190',                          // yere düşük
};

/** `arka`: Vuu'nun arkasına çizilecek dairenin rengi. Mercan zeminde Vuu kaybolmasın diye kullanılır. */
export function Maskot({ hal = 'merhaba', boyut = 96, arka, style }: { hal?: MaskotHal; boyut?: number; arka?: string; style?: ViewStyle }) {
  const r = tema.renk;
  const hareketli = tema.hareket.acik;
  const kuyruk = useRef(new Animated.Value(0)).current;
  const nefes = useRef(new Animated.Value(0)).current;
  const [kirp, setKirp] = useState(false);

  // Kuyruk: arama halinde hızlı, uykuda durur, diğer hallerde ağır ağır sallanır.
  useEffect(() => {
    if (!hareketli || hal === 'uyku') {
      kuyruk.setValue(0.5);
      return;
    }
    const sure = hal === 'arama' ? 320 : hal === 'mutlu' ? 520 : hal === 'nobet' ? 1800 : 1100;
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(kuyruk, { toValue: 1, duration: sure, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(kuyruk, { toValue: 0, duration: sure, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    dongu.start();
    return () => dongu.stop();
  }, [hal, hareketli, kuyruk]);

  // Nefes: uykuda belirgin, diğer hallerde çok hafif.
  useEffect(() => {
    if (!hareketli) return;
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(nefes, { toValue: 1, duration: hal === 'uyku' ? 1900 : 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(nefes, { toValue: 0, duration: hal === 'uyku' ? 1900 : 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    dongu.start();
    return () => dongu.stop();
  }, [hal, hareketli, nefes]);

  // Göz kırpma
  useEffect(() => {
    if (!hareketli || hal === 'uyku' || hal === 'mutlu') return;
    let kapat: ReturnType<typeof setTimeout>;
    const ac = setInterval(() => {
      setKirp(true);
      kapat = setTimeout(() => setKirp(false), 140);
    }, 3400);
    return () => {
      clearInterval(ac);
      clearTimeout(kapat);
    };
  }, [hal, hareketli]);

  if (!maskot.acik) return null;

  const kuyrukAcisi = kuyruk.interpolate({ inputRange: [0, 1], outputRange: hal === 'nobet' ? ['-2deg', '2deg'] : hal === 'uzgun' ? ['-2deg', '1deg'] : ['-7deg', '9deg'] });
  const govdeOlcek = nefes.interpolate({ inputRange: [0, 1], outputRange: [1, hal === 'uyku' ? 1.035 : 1.012] });
  const kulakDusuk = hal === 'uzgun' || hal === 'uyku';

  return (
    <View style={[{ width: boyut, height: boyut }, style]} accessibilityRole="image" accessibilityLabel={`${maskot.ad}, uygulamanın kedisi`}>
      {!!arka && <View style={{ position: 'absolute', left: -boyut * 0.06, top: -boyut * 0.02, width: boyut * 1.12, height: boyut * 1.12, borderRadius: boyut * 0.56, backgroundColor: arka }} />}
      {/* Kuyruk: logodaki sarı çizgi. Gövdenin arkasından, sağ alttan çıkar; kökünden döner. */}
      <Animated.View style={{ position: 'absolute', width: boyut, height: boyut, transformOrigin: '61% 91%', transform: [{ rotate: kuyrukAcisi }] }}>
        <Svg width={boyut} height={boyut} viewBox="0 0 200 200">
          <Path d={KUYRUK[hal]} stroke={r.sari} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: boyut, height: boyut, transformOrigin: '50% 95%', transform: [{ scaleY: govdeOlcek }] }}>
        <Svg width={boyut} height={boyut} viewBox="0 0 200 200">
          {/* gövde */}
          <Path d="M56 188 C50 128 66 104 100 104 C134 104 150 128 144 188 Z" fill={r.mercan} />
          <Ellipse cx={100} cy={156} rx={21} ry={27} fill={r.mercanAcik} />
          {/* patiler */}
          <Ellipse cx={82} cy={187} rx={14} ry={8} fill={r.beyaz} />
          <Ellipse cx={118} cy={187} rx={14} ry={8} fill={r.beyaz} />
          {/* kulaklar */}
          {kulakDusuk ? (
            <G>
              <Polygon points="52,66 40,34 84,46" fill={r.mercan} />
              <Polygon points="148,66 160,34 116,46" fill={r.mercan} />
              <Polygon points="56,58 49,41 74,48" fill={r.mercanKoyu} />
              <Polygon points="144,58 151,41 126,48" fill={r.mercanKoyu} />
            </G>
          ) : (
            <G>
              <Polygon points="52,66 58,12 94,44" fill={r.mercan} />
              <Polygon points="148,66 142,12 106,44" fill={r.mercan} />
              <Polygon points="60,54 63,28 82,45" fill={r.mercanKoyu} />
              <Polygon points="140,54 137,28 118,45" fill={r.mercanKoyu} />
            </G>
          )}
          {/* baş */}
          <Rect x={44} y={38} width={112} height={82} rx={38} fill={r.mercan} />
          {/* yanaklar */}
          <Circle cx={64} cy={96} r={7} fill={r.sari} opacity={0.55} />
          <Circle cx={136} cy={96} r={7} fill={r.sari} opacity={0.55} />
          <Gozler hal={hal} kapali={kirp} />
          {/* burun ve ağız */}
          <Polygon points="95,90 105,90 100,96" fill={r.murekkep} />
          {hal === 'uzgun' ? (
            <Path d="M91 104 Q100 97 109 104" stroke={r.murekkep} strokeWidth={3} strokeLinecap="round" fill="none" />
          ) : (
            <Path d="M100 96 Q95 103 89 99 M100 96 Q105 103 111 99" stroke={r.murekkep} strokeWidth={3} strokeLinecap="round" fill="none" />
          )}
          {/* bıyıklar */}
          <G stroke={r.murekkep} strokeWidth={2} strokeLinecap="round" opacity={0.45}>
            <Line x1={54} y1={88} x2={34} y2={84} />
            <Line x1={54} y1={95} x2={34} y2={98} />
            <Line x1={146} y1={88} x2={166} y2={84} />
            <Line x1={146} y1={95} x2={166} y2={98} />
          </G>
          {/* tasma: logodaki sarı çizgi, ucunda eğik künye */}
          <Rect x={70} y={114} width={60} height={9} rx={4.5} fill={r.sari} />
          <Polygon points="97,123 107,123 104,135 94,135" fill={r.murekkep} />
        </Svg>
      </Animated.View>

      {hal === 'uyku' && (
        <Text style={{ position: 'absolute', right: boyut * 0.02, top: -boyut * 0.04, fontFamily: tema.yazi.monoKalin, fontSize: boyut * 0.16, color: r.lila }}>z z</Text>
      )}
    </View>
  );
}

/** Vuu konuşuyor: maskot ve konuşma balonu yan yana. */
export function VuuDer({ hal, soz, koyuZemin = false, boyut = 76, arka, style }: { hal: MaskotHal; soz: string; koyuZemin?: boolean; boyut?: number; arka?: string; style?: ViewStyle }) {
  const r = tema.renk;
  const giris = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    giris.setValue(0);
    Animated.spring(giris, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }).start();
  }, [soz, giris]);
  const balon = koyuZemin ? r.murekkep2 : r.beyaz;
  if (!maskot.acik) {
    return <Text style={[{ fontFamily: tema.yazi.metinOrta, fontSize: 15, lineHeight: 21, color: koyuZemin ? r.beyaz : r.murekkep }, style as object]}>{soz}</Text>;
  }
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: arka ? 14 : 4 }, style]}>
      <Maskot hal={hal} boyut={boyut} arka={arka} />
      <Animated.View style={{ flex: 1, marginBottom: boyut * 0.28, opacity: giris, transform: [{ scale: giris.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <View style={{ backgroundColor: balon, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 11, boxShadow: koyuZemin ? 'none' : tema.golge }}>
          <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 15, lineHeight: 21, color: koyuZemin ? r.beyaz : r.murekkep }}>{soz}</Text>
        </View>
      </Animated.View>
    </View>
  );
}


/** Vuu'nun yüzü: QR kodlarının ortasında ve küçük alanlarda kullanılır. Hareketsizdir. */
export function VuuRozet({ boyut = 44 }: { boyut?: number }) {
  const r = tema.renk;
  return (
    <Svg width={boyut} height={boyut} viewBox="30 -4 140 140" accessibilityLabel={maskot.ad}>
      <Polygon points="52,66 58,12 94,44" fill={r.mercan} />
      <Polygon points="148,66 142,12 106,44" fill={r.mercan} />
      <Polygon points="60,54 63,28 82,45" fill={r.mercanKoyu} />
      <Polygon points="140,54 137,28 118,45" fill={r.mercanKoyu} />
      <Rect x={44} y={38} width={112} height={82} rx={38} fill={r.mercan} />
      <Circle cx={64} cy={96} r={7} fill={r.sari} opacity={0.55} />
      <Circle cx={136} cy={96} r={7} fill={r.sari} opacity={0.55} />
      <G stroke={r.murekkep} strokeWidth={5} strokeLinecap="round" fill="none">
        <Path d="M69 82 Q78 70 87 82" />
        <Path d="M113 82 Q122 70 131 82" />
      </G>
      <Polygon points="95,90 105,90 100,96" fill={r.murekkep} />
      <Path d="M100 96 Q95 103 89 99 M100 96 Q105 103 111 99" stroke={r.murekkep} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Rect x={70} y={114} width={60} height={9} rx={4.5} fill={r.sari} />
    </Svg>
  );
}
