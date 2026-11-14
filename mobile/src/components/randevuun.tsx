// randevuun kartları ve QR.
//   AjandaKarti: hizmet randevusu, masa takvimi yaprağı biçiminde.
//   BiletKarti:  etkinlik, yırtma çizgili bilet biçiminde.
// İkisinin de ortasında QR, QR'ın ortasında Vuu'nun yüzü vardır.

import qrcode from 'qrcode-generator';
import React, { useMemo } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ayUzun, Booking, gunNo, gunUzun, para, saat, tarih, Ticket, yil } from '@/api';
import { t, tema } from '@/config';

import { VuuRozet } from './Maskot';
import { Etiket, RandevuuKarti } from './ui';

// QR içeriği: işletme ya da organizatör okuttuğunda bu adres randevuunu açar.
export const qrAdresi = (tur: 'r' | 'b', id: string) => `https://randevuu.app/${tur}/${id}`;

/**
 * QR kod. En yüksek hata düzeltme (H, %30) kullanılır; ortadaki Vuu yüzeyin %7 kadarını kapatır,
 * kod yine de okunur. Etrafında okuyucuların ihtiyaç duyduğu sessiz alan bırakılır.
 */
export function QR({ veri, boyut = 156 }: { veri: string; boyut?: number }) {
  const r = tema.renk;
  const { yol, n } = useMemo(() => {
    const q = qrcode(0, 'H');
    q.addData(veri);
    q.make();
    const adet = q.getModuleCount();
    let d = '';
    for (let y = 0; y < adet; y++) for (let x = 0; x < adet; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { yol: d, n: adet };
  }, [veri]);
  const sessiz = 4; // standardın istediği en az sessiz alan; koyu zeminde okunabilirlik için şart
  const rozet = Math.round(boyut * 0.24);
  return (
    <View style={{ width: boyut, height: boyut, backgroundColor: r.beyaz, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel="QR kod">
      <Svg width={boyut} height={boyut} viewBox={`${-sessiz} ${-sessiz} ${n + sessiz * 2} ${n + sessiz * 2}`}>
        <Path d={yol} fill={r.murekkep} />
      </Svg>
      <View style={{ position: 'absolute', width: rozet, height: rozet, borderRadius: rozet * 0.28, backgroundColor: r.beyaz, alignItems: 'center', justifyContent: 'center' }}>
        <VuuRozet boyut={rozet * 0.92} />
      </View>
    </View>
  );
}

function KodSatiri({ kod, ipucu, koyu }: { kod: string; ipucu: string; koyu: boolean }) {
  const r = tema.renk;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 24, letterSpacing: 6, color: koyu ? r.sari : r.murekkep }}>{kod}</Text>
      <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 12, color: koyu ? r.lila : r.duman }}>{ipucu}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- hizmet: ajanda yaprağı

export function AjandaKarti({ b, qrBoyut = 148, children, style }: { b: Booking; qrBoyut?: number; children?: React.ReactNode; style?: ViewStyle }) {
  const r = tema.renk;
  const kalan = b.price - b.deposit_paid;
  const halka = { position: 'absolute' as const, top: -10, width: 12, height: 28, borderRadius: 6, backgroundColor: r.murekkep };
  return (
    <View style={[{ backgroundColor: r.beyaz, borderRadius: tema.kose.kart, boxShadow: tema.golgeGuclu }, style]}>
      {/* takvim başlığı: ay ve yıl */}
      <View style={{ backgroundColor: r.mercan, borderTopLeftRadius: tema.kose.kart, borderTopRightRadius: tema.kose.kart, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: tema.yazi.baslik, fontSize: 16, color: r.murekkep }}>{ayUzun(b.start)} {yil(b.start)}</Text>
        <Etiket>{t('randevuun.etiket')}</Etiket>
      </View>
      {/* spiral halkalar */}
      <View style={[halka, { left: '24%' }]} />
      <View style={[halka, { right: '24%' }]} />

      <View style={{ flexDirection: 'row', paddingVertical: 18, paddingRight: 18 }}>
        <View style={{ width: 96, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 13, color: r.mercanKoyu }}>{gunUzun(b.start)}</Text>
          <Text style={{ fontFamily: tema.yazi.kalin, fontSize: 60, lineHeight: 64, color: r.murekkep }}>{gunNo(b.start)}</Text>
          <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 13, color: r.duman }}>{ayUzun(b.start)}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: r.cizgi, marginRight: 16 }} />
        <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
          <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 22, color: r.murekkep }}>{saat(b.start)}–{saat(b.end)}</Text>
          <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 16, color: r.murekkep, marginTop: 4 }}>{b.provider.name}</Text>
          <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, color: r.duman }}>{b.service}</Text>
          <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{b.provider.address}</Text>
        </View>
      </View>

      {/* defter çizgileri arasında QR */}
      <View style={{ marginHorizontal: 18, borderTopWidth: 1, borderTopColor: r.cizgi, paddingTop: 16, paddingBottom: 18, alignItems: 'center', gap: 10 }}>
        <View style={{ padding: 6, borderRadius: 20, backgroundColor: r.sis }}>
          <QR veri={qrAdresi('r', b.id)} boyut={qrBoyut} />
        </View>
        <KodSatiri kod={b.code} ipucu={t('randevuun.kapidaGoster')} koyu={false} />
        {b.deposit_paid > 0 && (
          <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 13, color: r.onay }}>
            {t('randevuun.onOdemeYapildi', { tutar: para(b.deposit_paid) })} · {t('randevuun.kalanOrada', { tutar: para(kalan) })}
          </Text>
        )}
      </View>
      {children && <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>{children}</View>}
    </View>
  );
}

/** Ana sayfada sıradaki randevuun: ajanda yaprağının küçük hali. */
export function MiniAjanda({ b }: { b: Booking }) {
  const r = tema.renk;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: r.beyaz, borderRadius: tema.kose.kart, overflow: 'hidden', boxShadow: tema.golge }}>
      <View style={{ width: 78, backgroundColor: r.mercan, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}>
        <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 12, color: r.murekkep }}>{tarih(b.start).split(' ')[0]}</Text>
        <Text style={{ fontFamily: tema.yazi.kalin, fontSize: 34, lineHeight: 38, color: r.murekkep }}>{gunNo(b.start)}</Text>
        <Text style={{ fontFamily: tema.yazi.metinOrta, fontSize: 12, color: r.murekkep }}>{ayUzun(b.start).slice(0, 3)}</Text>
      </View>
      <View style={{ flex: 1, padding: 14, justifyContent: 'center', gap: 2 }}>
        <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 18, color: r.murekkep }}>{saat(b.start)}–{saat(b.end)}</Text>
        <Text style={{ fontFamily: tema.yazi.metinKalin, fontSize: 15, color: r.murekkep }}>{b.provider.name}</Text>
        <Text style={{ fontFamily: tema.yazi.metin, fontSize: 13, color: r.duman }}>{b.service}</Text>
      </View>
      <View style={{ justifyContent: 'center', paddingRight: 14 }}>
        <VuuRozet boyut={40} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- etkinlik: bilet

export function BiletKarti({ b, zemin, qrBoyut = 148, style }: { b: Pick<Ticket, 'id' | 'code' | 'qty' | 'title' | 'start' | 'end' | 'place' | 'visibility' | 'amount'>; zemin?: string; qrBoyut?: number; style?: ViewStyle }) {
  const r = tema.renk;
  return (
    <RandevuuKarti zemin={zemin} style={style} alt={
      <View style={{ alignItems: 'center', gap: 10 }}>
        <QR veri={qrAdresi('b', b.id)} boyut={qrBoyut} />
        <KodSatiri kod={b.code} ipucu={`${t('randevuun.giristeGoster')} · ${t('randevuun.biletAdet', { n: b.qty })}`} koyu />
      </View>
    }>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Etiket>{t(b.visibility === 'private' ? 'randevuun.davet' : 'randevuun.etkinlik')}</Etiket>
        <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 15, color: r.sari }}>{para(b.amount)}</Text>
      </View>
      <Text style={{ fontFamily: tema.yazi.baslik, fontSize: 24, lineHeight: 28, color: r.beyaz, marginTop: 14 }}>{b.title}</Text>
      <Text style={{ fontFamily: tema.yazi.monoKalin, fontSize: 16, color: r.sari, marginTop: 8 }}>{tarih(b.start)} · {saat(b.start)}–{saat(b.end)}</Text>
      <Text style={{ fontFamily: tema.yazi.metin, fontSize: 14, color: r.lila, marginTop: 2 }}>{b.place}</Text>
    </RandevuuKarti>
  );
}
