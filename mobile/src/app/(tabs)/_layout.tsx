import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, tema } from '@/config';

const SEKME: Record<string, string> = { index: 'sekme.kesfet', ara: 'sekme.ara', cuzdan: 'sekme.yerlerim' };

// Sekme çubuğu ikon kullanmaz: seçili sekmenin üstünde logodaki sarı çizgi durur.
function SekmeCubugu({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const alt = useSafeAreaInsets().bottom;
  const r = tema.renk;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: r.beyaz, paddingBottom: Math.max(alt, 10), paddingTop: 6, borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0px -8px 24px rgba(23, 19, 43, 0.08)' }}>
      {state.routes.map((route, i) => {
        const aktif = state.index === i;
        return (
          <Pressable key={route.key} onPress={() => navigateToTab(route.key)} accessibilityRole="tab" accessibilityState={{ selected: aktif }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 7 }}>
            <View style={{ width: 6, height: 16, borderRadius: 2, backgroundColor: aktif ? r.sari : 'transparent', transform: [{ skewX: tema.egim }] }} />
            <Text style={{ fontFamily: aktif ? tema.yazi.metinKalin : tema.yazi.metinOrta, fontSize: 14, color: aktif ? r.murekkep : r.duman }}>{t(SEKME[route.name] ?? route.name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <SekmeCubugu state={props.state} navigateToTab={props.navigateToTab} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ara" />
      <Tabs.Screen name="cuzdan" />
    </Tabs>
  );
}
