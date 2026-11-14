// Tanışma: Vuu kendini üç sahnede anlatır. Sahneler config/maskot.ts içindeki "hikaye" listesinden gelir.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Maskot } from '@/components/Maskot';
import { Baslik, Dugme, Wordmark } from '@/components/ui';
import { maskot, metinler, t, tema } from '@/config';

export default function Tanisma() {
  const insets = useSafeAreaInsets();
  const r = tema.renk;
  const [i, setI] = useState(0);
  const giris = useRef(new Animated.Value(0)).current;
  const sahne = maskot.hikaye[i];
  const son = i === maskot.hikaye.length - 1;

  useEffect(() => {
    giris.setValue(0);
    Animated.spring(giris, { toValue: 1, useNativeDriver: true, damping: 13, stiffness: 120 }).start();
  }, [i, giris]);

  const bitir = () => {
    AsyncStorage.setItem('tanisma-goruldu', '1').catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: r.murekkep, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 20) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 }}>
        <Wordmark koyuZemin size={22} />
        {!son && (
          <Pressable onPress={bitir} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 15, color: r.lila }}>{t('tanisma.atla')}</Text>
          </Pressable>
        )}
      </View>

      {/* Sahne: mercan dairenin önünde Vuu */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: r.murekkep2, top: 0 }} />
          <View style={{ position: 'absolute', width: 180, height: 22, borderRadius: 11, backgroundColor: r.murekkep3, bottom: 6, opacity: 0.6 }} />
          <Animated.View style={{ opacity: giris, transform: [{ translateY: giris.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: giris.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
            <Maskot hal={sahne.hal} boyut={250} />
          </Animated.View>
        </View>
      </View>

      <View style={{ backgroundColor: r.beyaz, marginHorizontal: 16, borderRadius: tema.kose.sayfa, padding: 24, gap: 14, boxShadow: tema.golgeGuclu }}>
        <Baslik ince={sahne.baslikInce} kalin={sahne.baslikKalin} size={34} />
        <Text style={{ fontFamily: tema.yazi.metin, fontSize: 16, lineHeight: 24, color: r.duman, minHeight: 96 }}>{sahne.metin}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${i + 1} / ${maskot.hikaye.length}`}>
            {maskot.hikaye.map((_, k) => (
              <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? r.mercan : r.dolu }} />
            ))}
          </View>
          <Dugme onPress={() => (son ? bitir() : setI(i + 1))} style={{ flex: 1, maxWidth: 220 }}>{son ? t('tanisma.basla') : t('tanisma.devam')}</Dugme>
        </View>
        {son && <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 13, color: r.duman, textAlign: 'center' }}>{metinler.marka.motto}</Text>}
      </View>
    </View>
  );
}
