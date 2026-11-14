// MASKOT: Vuu'nun kim olduğu, hikâyesi ve hangi anda ne söylediği buradadır.
// Vuu'yu susturmak, adını ya da cümlelerini değiştirmek için yalnızca bu dosyayı düzenle.
//
// Haller (çizimi components/Maskot.tsx içinde):
//   merhaba: sakin oturur · arama: gözleriyle etrafı tarar, kuyruğu hızlı sallanır
//   mutlu: gözleri güler · uyku: gözleri kapalı · nobet: gözleri kocaman, kuyruk dik · uzgun: kulakları düşük

export type MaskotHal = 'merhaba' | 'arama' | 'mutlu' | 'uyku' | 'nobet' | 'uzgun';

export const maskot = {
  ad: 'Vuu',
  acik: true, // false: Vuu hiçbir ekranda görünmez, yalnızca metinler kalır

  // Kim bu Vuu? Tanışma ekranında üç sahnede anlatılır.
  hikaye: [
    {
      hal: 'merhaba' as MaskotHal,
      baslikInce: 'Selam, ben',
      baslikKalin: 'Vuu.',
      metin: 'Mahallenin kedisiyim. Buradaki her boş koltuğu, her boş sandalyeyi bilirim; çünkü hepsinde bir kere uyudum.',
    },
    {
      hal: 'arama' as MaskotHal,
      baslikInce: 'Sen söyle,',
      baslikKalin: 'ben bulayım.',
      metin: 'Ne lazımsa söyle: diş hekimi, kuaför, güzellik, oto yıkama, veteriner… Kimde ne zaman boş yer varsa koşup bakarım.',
    },
    {
      hal: 'mutlu' as MaskotHal,
      baslikInce: 'Yerini',
      baslikKalin: 'ben tutarım.',
      metin: 'Seçtiğin an senindir. Sen gelene kadar üstünde oturur, kimseye kaptırmam. Yer yoksa nöbet tutar, boşalınca ilk sana haber veririm.',
    },
  ],

  // Olay döngüleri: uygulamadaki her durumda Vuu'nun hali ve sözü.
  sahne: {
    karsilama: { hal: 'merhaba' as MaskotHal, soz: 'Selam! Ne lazımsa yaz, yerini ben tutayım.' },
    siradaki: { hal: 'nobet' as MaskotHal, soz: '{gun} {saat}, {isletme}. Yerini tutuyorum, merak etme.' },
    yaziyor: { hal: 'arama' as MaskotHal, soz: 'Kulağım sende…' },
    oneriYok: { hal: 'uzgun' as MaskotHal, soz: 'Bunu henüz bilmiyorum. Başka bir kelimeyle dener misin? Mesela "saç" ya da "araba".' },
    gozAt: { hal: 'merhaba' as MaskotHal, soz: 'Ne aradığını bilmiyorsan sorun değil, birlikte bakalım.' },
    araniyor: { hal: 'arama' as MaskotHal, soz: 'Mahalleyi dolaşıyorum…' },
    bulundu: { hal: 'mutlu' as MaskotHal, soz: '{n} yerde sana uygun an buldum.' },
    bulunduTek: { hal: 'mutlu' as MaskotHal, soz: 'Bir yer buldum, tam sana göre.' },
    bulunamadi: { hal: 'uyku' as MaskotHal, soz: 'Bu aralıkta her yer dolu. Ben biraz kestireyim, sen aralığı genişlet.' },
    anSec: { hal: 'merhaba' as MaskotHal, soz: 'Hangi an sana uyar? Mercan olanlar boş.' },
    anSecildi: { hal: 'mutlu' as MaskotHal, soz: '{saat} güzel seçim. Tutayım mı?' },
    gunDolu: { hal: 'nobet' as MaskotHal, soz: 'Bugün dolu ama pes etmek yok. Nöbete geçeyim mi?' },
    nobette: { hal: 'nobet' as MaskotHal, soz: 'Nöbetteyim. Yer boşalınca ilk sana miyavlarım.' },
    onay: { hal: 'merhaba' as MaskotHal, soz: 'Her şey tamam mı? Bir bak, sonra yerini tutuyorum.' },
    yerHazir: { hal: 'mutlu' as MaskotHal, soz: 'randevuun hazır. Yerini ısıttım bile.' },
    doldu: { hal: 'uzgun' as MaskotHal, soz: 'Tüh, bu anı az önce biri kaptı. Başka bir ana bakalım mı?' },
    yerlerimBos: { hal: 'uyku' as MaskotHal, soz: 'Henüz bir randevuun yok. Uyandır beni, birlikte bulalım.' },
    yerlerimDolu: { hal: 'nobet' as MaskotHal, soz: 'randevuuların bende. Hiçbirini kaptırmadım.' },
    vazgecildi: { hal: 'merhaba' as MaskotHal, soz: 'Tamamdır, yeri bıraktım. Başkası sevinecek.' },
    etkinlik: { hal: 'merhaba' as MaskotHal, soz: 'Kalabalık toplanıyor. Sana da yer ayırayım mı?' },
    etkinlikDolu: { hal: 'uzgun' as MaskotHal, soz: 'Bu etkinlik doldu. Bir dahakine erken haber veririm.' },
    biletHazir: { hal: 'mutlu' as MaskotHal, soz: 'randevuun cebinde. Orada görüşürüz!' },
    hata: { hal: 'uzgun' as MaskotHal, soz: 'Patim kaydı, bir şey ters gitti.' },
    // Bildirimler (bildirim altyapısı bağlandığında kullanılacak)
    hatirlatmaGun: { hal: 'nobet' as MaskotHal, soz: 'Yarın {saat}, {isletme}. Yerini tutuyorum.' },
    hatirlatmaSaat: { hal: 'arama' as MaskotHal, soz: 'İki saat kaldı! {isletme} seni bekliyor.' },
    yerBosaldi: { hal: 'mutlu' as MaskotHal, soz: 'Miyav! {isletme} için {saat} boşaldı. 10 dakika içinde kap.' },
  },
};

export type Maskot = typeof maskot;
export type Sahne = keyof typeof maskot.sahne;
