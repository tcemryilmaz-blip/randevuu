import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Outfit_300Light, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { API_URL } from '@/api';
import { tema, uzakAyarlariYukle } from '@/config';

export default function RootLayout() {
  const [yaziHazir] = useFonts({
    Outfit_300Light, Outfit_700Bold, Outfit_800ExtraBold,
    Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold,
    JetBrainsMono_500Medium, JetBrainsMono_700Bold,
  });
  // Uzaktan ayarlar ilk ekrandan önce yüklenir; sunucuya ulaşılamazsa varsayılanlarla açılır.
  const [ayarHazir, setAyarHazir] = useState(false);
  useEffect(() => {
    uzakAyarlariYukle(API_URL).finally(() => setAyarHazir(true));
  }, []);

  if (!yaziHazir || !ayarHazir) return <View style={{ flex: 1, backgroundColor: tema.renk.murekkep }} />;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tema.renk.sis } }} />
    </>
  );
}
