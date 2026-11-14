// METİNLER: uygulamadaki her yazı buradadır. Ekranlarda sabit metin yoktur.
// {süslü} parantezler değişkendir: t('ara.sonuc', { n: 3 }) → "3 yer · en erken ana göre".
// Sözlük: "an" = ayırtılabilir saat, "an çizgisi" = günün doluluk çizgisi,
// "randevuun" = ayırttığın her şey (randevu, bilet ya da davet), "randevuularım" = hepsinin durduğu yer.
// Hizmet alanlarının adları ve eş anlamlıları uygulamada değil sunucuda durur: backend/catalog.json.

export const metinler = {
  marka: {
    motto: 'Vuu bulur, sen gelirsin.',
    // Denenebilecek başka mottolar: 'Anını yakala.' · 'Yerin hazır, sen gel.' · 'Şimdi, daha kolay.'
    sehir: 'Kadıköy',
  },
  sekme: { kesfet: 'Keşfet', ara: 'Ara', yerlerim: 'randevuularım' },

  // Zaman pencereleri. "Yarın akşam" seçici çubukta görünmez; yalnızca aramada yazılınca seçilir.
  pencere: { simdi: 'Şimdi', aksam: 'Bu akşam', yarin: 'Yarın', yarinAksam: 'Yarın akşam', haftasonu: 'Hafta sonu', hafta: 'Bu hafta' },

  arama: {
    kutu: 'Ne arıyorsun?',
    // Arama kutusunda sırayla dönen örnekler: kullanıcıya neler yazabileceğini gösterir.
    ornekler: ['Manikür, yarın akşam', 'Diş taşı temizliği', 'Oto yıkama, hafta sonu', 'Saç kesimi, bugün', 'Veteriner, aşı'],
    // Aramada geçen bu kelimeler zamanı seçer ve aranan metinden çıkarılır. Uzun ifadeler önce denenir.
    zamanKelimeleri: {
      yarinAksam: ['yarın akşam', 'yarın akşamı'],
      aksam: ['bu akşam', 'bugün akşam', 'akşam'],
      simdi: ['şimdi', 'hemen', 'bugün', 'acil'],
      yarin: ['yarın'],
      haftasonu: ['hafta sonu', 'haftasonu', 'cumartesi', 'pazar'],
      hafta: ['bu hafta', 'hafta içi'],
    },
    zamanEtiketi: 'Zaman: {pencere}',
    tur: { alan: 'Hizmet alanı', hizmet: 'Hizmet', isletme: 'İşletme' },
    son: 'Son aradıkların',
    hizmetler: 'Hizmetlere göz at',
    temizle: 'Aramayı temizle',
    alanAdet: '{n} yer',
  },

  kesfet: {
    baslikInce: 'Bugün sana',
    baslikKalin: 'ne lazım?',
    siradaki: 'Sıradaki randevuun',
    son: 'Kaldığın yerden',
    yakinda: 'Yakında neler var?',
    gozAt: 'Tüm hizmetlere göz at',
  },
  ara: {
    zaman: 'Ne zaman olsun?',
    sonuc: '{n} yer · en erken ana göre · {sehir}',
    genislet: 'Bu haftaya bak',
  },
  kart: {
    bosAn: '{gun} · {n} boş an',
    yerKaldi: '{n} yer kaldı',
    tukendi: 'Tükendi',
  },
  isletme: {
    hizmet: 'Ne için?',
    gun: 'Hangi gün?',
    saat: 'Hangi an?',
    dakika: '{n} dk',
    sec: 'Bir an seç',
    ayirt: 'Bu an benim',
    haberVer: 'Boşalınca haber ver',
    siradaBaslik: 'Sıradasın · {n}. kişi',
  },
  onay: {
    baslikInce: 'Son bir',
    baslikKalin: 'bakış',
    onOdeme: 'Şimdi ön ödeme',
    simdi: 'Şimdi ödenecek',
    kalan: 'Orada ödenecek',
    iptalBaslik: 'Vazgeçersen: ',
    iptalMetin: "{zaman}'e kadar ücretsiz iptal. Sonrasında ön ödeme geri verilmez.",
    riza: 'Sağlık randevum için verilerimin işlenmesine açık rıza veriyorum. Aydınlatma metnini okudum.',
    rizaEksik: 'Önce açık rızayı işaretle',
    ode: '{tutar} ön ödeme yap, yerimi tut',
    tut: 'Yerimi tut',
    gonderiliyor: 'Yerin tutuluyor…',
    yukleniyor: 'Bir saniye…',
    baskaAn: 'Başka an seç',
    gelistirme: 'Deneme sürümü: gerçek ödeme alınmaz.',
  },
  // randevuun kartları: hizmet için ajanda yaprağı, etkinlik için bilet.
  randevuun: {
    etiket: 'randevuun',
    etkinlik: 'randevuun · etkinlik',
    davet: 'randevuun · özel davet',
    kapidaGoster: 'Kapıda göster',
    giristeGoster: 'Girişte göster',
    onOdemeYapildi: '{tutar} ön ödeme yapıldı',
    kalanOrada: 'Kalan {tutar} orada',
    biletAdet: '{n} kişilik',
  },
  basari: {
    baslikInce: 'randevuun',
    baslikKalin: 'hazır.',
    onOdemeli: '{onOdeme} ön ödeme alındı, kalan {kalan} orada ödenir.',
    onOdemesiz: 'Ücret ({tutar}) orada ödenir.',
    hatirlatma: 'Bir gün ve iki saat kala haber veririm.',
    git: 'randevuularıma git',
    biletInce: 'randevuun',
    biletKalin: 'cebinde.',
  },
  yerlerim: {
    baslikInce: 'randevuu',
    baslikKalin: 'larım',
    bul: 'Aramaya başla',
    iptal: 'Vazgeç',
    iptalSoru: 'Bu randevuundan vazgeçmek istediğine emin misin?',
    iptalHayir: 'Kalsın',
    iptalEvet: 'Vazgeçiyorum',
    iptalIadeli: 'Ön ödemen geri dönecek.',
    siraEtiket: 'haber bekliyorsun',
    siraNo: '{n}. sıradasın',
    siraBosaldi: 'An boşaldı!',
    siraMetin: '{isletme} · {gun}. Boşalınca ilk sana haber veririm.',
    siraTeklif: '{isletme} · {gun}. Hemen bak, yoksa sıradakine geçer.',
    siraGor: 'Ana bak',
  },
  etkinlik: {
    etiketAcik: 'açık etkinlik',
    etiketOzel: 'özel etkinlik',
    bulusma: 'Buluşma: {yer} · Düzenleyen: {kim}',
    kontenjan: 'Kimler geliyor?',
    durum: '{dolu} kişi geliyor · {kalan} yer kaldı',
    bilet: 'Bilet',
    kisiBasi: '{tutar} · kişi başı',
    al: 'Ben de geliyorum · {tutar}',
    aliniyor: 'Biletin hazırlanıyor…',
    azalt: 'Bir azalt',
    arttir: 'Bir arttır',
  },
  tanisma: {
    atla: 'Geç',
    devam: 'Devam',
    basla: 'Hadi başlayalım',
  },
  genel: {
    geri: 'Geri',
    tekrar: 'Tekrar dene',
    ulasilamadi: 'Şu an bağlanamıyorum. İnternetini kontrol edip tekrar dener misin?',
    ucretsiz: 'Ücretsiz',
  },
};

export type Metinler = typeof metinler;
