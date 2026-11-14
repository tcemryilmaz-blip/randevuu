// TEMA: uygulamanın görünümüne dair her şey buradadır.
// Bir rengi, köşe yarıçapını ya da yazı tipini değiştirmek için yalnızca bu dosyayı düzenle.
// Aynı anahtarlar sunucudaki app_config.json ile uzaktan da ezilebilir (bkz. config/index.ts).

export const tema = {
  renk: {
    mercan: '#FF5A4E',      // ana renk: boş an, ana düğme, Vuu
    mercanKoyu: '#D93A2E',  // açık zeminde vurgu yazısı, Vuu'nun kulak içi
    mercanAcik: '#FFD9D4',  // Vuu'nun göğsü, yumuşak vurgu zemini
    sari: '#FFC531',        // logodaki çizgi, Vuu'nun kuyruğu ve tasması
    murekkep: '#17132B',    // yazı ve koyu zemin
    murekkep2: '#241E40',   // koyu zeminde ikinci katman
    murekkep3: '#3A3556',   // koyu zeminde dolu an
    duman: '#5E5A72',       // ikincil yazı
    lila: '#B9B5CC',        // koyu zeminde ikincil yazı
    dolu: '#ECEAF2',        // dolu an: bilerek soluk, göz yormasın
    doluYazi: '#6F6B82',
    cizgi: '#E4E2EC',
    sis: '#F4F3F8',         // sayfa zemini
    beyaz: '#FFFFFF',
    onay: '#0B7A53',
  },
  yazi: {
    ince: 'Outfit_300Light',
    kalin: 'Outfit_800ExtraBold',
    baslik: 'Outfit_700Bold',
    metin: 'Figtree_400Regular',
    metinOrta: 'Figtree_600SemiBold',
    metinKalin: 'Figtree_700Bold',
    mono: 'JetBrainsMono_500Medium',    // saat, tutar, kod
    monoKalin: 'JetBrainsMono_700Bold',
  },
  kose: { kart: 22, pul: 14, dugme: 18, sayfa: 32 },
  // Derinlik: kartlar zeminden hafifçe kalkar. Kapatmak için 'none' yaz.
  golge: '0px 10px 28px rgba(23, 19, 43, 0.10)',
  golgeGuclu: '0px 18px 40px rgba(23, 19, 43, 0.22)',
  // Logodaki eğim. Yalnızca logo ve küçük vurgularda kullanılır; saat pulları düzdür.
  egim: '-14deg',
  an: {
    yukseklik: 8,   // an çizgisinin kalınlığı
    bosluk: 3,      // dilimler arası boşluk
    kartta: 3,      // sonuç kartında gösterilecek saat pulu sayısı
  },
  hareket: {
    acik: true,     // false: tüm süsleme animasyonları kapanır (kuyruk, göz kırpma, an çizgisi)
  },
};

export type Tema = typeof tema;
