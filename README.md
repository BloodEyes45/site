# Sema — Günün Ritmi

Sema için hazırlanmış, telefonda kullanılmak üzere tasarlanmış bir **PWA**. Saf HTML, CSS ve JavaScript ile çalışır; derleme adımı yoktur.

Açık tema varsayılandır. Sağ üstteki güneş/ay düğmesiyle koyu temaya geçilebilir. Arayüz Apple'ın liquid-glass dilinden ilham alır: yumuşak ışık, yarı saydam cam katmanlar, yuvarlatılmış yüzeyler ve sakin bir renk paleti.

## Neler var?

- **Bugün:** Saate göre “Günaydın / İyi akşamlar” karşılaması, tarih, canlı saat, anlık hava durumu.
- **Canlı konum:** Uygulama açılırken konum izni ister ve `watchPosition` ile bulunduğun yeri otomatik takip eder. Konum değiştirme, arama veya “burayı kullan” yoktur. Hava durumu ve harita sürekli canlı konuma göre güncellenir.
- **Hava durumu:** Karta dokununca saatlik ve 7 günlük tahmin. Open-Meteo kullanılır.
- **Dinamik gökyüzü:** Ana sayfa ve bahçe gerçek hava durumuna göre değişir. Yağmurda camda damlalar, karda kar taneleri, açık gecede yıldızlar, gün doğumu/batımında turuncu ışık.
- **Harita:** Canlı konumun işaretlendiği, sürüklenebilir ve yakınlaştırılabilir harita. “Konumuma dön” ile tekrar canlı konuma dönersin.
- **Ders programı:** Pazartesi'den Pazar'a gün gün gezinme, ders ekleme, düzenleme ve silme.
- **Biz:** Çizim yerine birlikte büyütülen **ortak bahçe**. Su damlatma, kalp gönderme ve küçük notlar. Günün sorusu yok.
- **PWA:** Ana ekrana ekleme, tam ekran açılış, çevrimdışı uygulama kabuğu.
- **Ayarlar ekranı yok.** Tema dışında bir tercih ekranı bulunmuyor.

## Derslik / amfi bilgileri

Yüklenen program:

| Gün | Ders | Yer |
|---|---|---|
| Pazartesi | Yaşlıda Akut ve Kronik Hastalıklar | Derslik 7 |
| Pazartesi | Sağlık Sosyolojisi | Derslik 3 |
| Salı | Yaşlıda Beslenme | Derslik 3 |
| Salı | Fiziksel Rehabilitasyon | Derslik 6 |
| Salı | Geriatrik Psikiyatri | Derslik 6 |
| Salı | Sağlık İşletmelerinde Yönetim | Amfi C |
| Çarşamba | Çevre Koruma | Amfi C |
| Çarşamba | Yaşlıda Akut ve Kronik Hastalıklar | Amfi C |

Tüm derslerin yerleri tanımlı. Yine de bir dersin yerini değiştirmek istersen **Dersler → ders kartı → Derslik / Amfi** alanını kullanabilirsin. Yeni ders eklerken gün, başlangıç, bitiş ve yer bilgisi girilir; çakışan saat aralıkları engellenir.

## Çalıştırma

Service worker ve PWA özellikleri için siteyi `file://` ile değil, küçük bir yerel sunucuyla aç:

```bash
python -m http.server 8791
```

Sonra:

```text
http://localhost:8791
```

Telefonda PWA olarak kurmak için sitenin **HTTPS** üzerinden yayınlanması gerekir:

- Netlify Drop / Vercel / Cloudflare Pages üzerine klasörü yükle,
- veya GitHub Pages kullan.

Sonra iPhone'da Safari → Paylaş → **Ana Ekrana Ekle**, Android/Chrome'da menü → **Uygulamayı yükle**.

Konum izni de HTTPS (veya localhost) gerektirir.

## Firebase

Firebase yapılandırması doğrudan [firebase-config.js](assets/js/firebase-config.js) içinde gömülüdür:

```text
Proje: semaasistan-9dca3
Veritabanı: https://semaasistan-9dca3-default-rtdb.firebaseio.com
Ortak alan: spaces/semaasistan
```

Eşleşme kodu, URL girişi veya “Eşleş” ekranı yoktur. İki cihaz da aynı uygulamayı açtığında aynı ortak alanı kullanır.

### Tek seferlik izin

Firebase projesinin Realtime Database kuralları şu an dışarıdan okuma/yazmaya kapalıdır; bu yüzden uygulamada **“İzin gerekli”** görünür. Bir kez şu adımı yap:

1. [Firebase Console](https://console.firebase.google.com/project/semaasistan-9dca3/database) → **Realtime Database → Rules**.
2. Aşağıdaki kuralı yapıştır ve **Publish** et:

```json
{
  "rules": {
    "spaces": {
      "semaasistan": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Alternatif olarak proje kökündeki [database.rules.json](database.rules.json) dosyasını Firebase CLI ile yayınlayabilirsin:

```bash
firebase deploy --only database
```

> Bu kural, ortak alanı bilen herkese açık hale getirir. Kişisel bir uygulama için pratik bir çözümdür; hassas bilgi paylaşmayın. Daha sıkı bir kurulum için Firebase Authentication gerekir.

Kurallar açıldıktan sonra uygulama otomatik bağlanır; bahçe, notlar ve kalpler iki cihazda ortak olur. Bağlantı gelene kadar her şey cihazda saklanır.

## Veriler nerede tutulur?

- Profil, dersler, tema ve son konum: `localStorage`
- Bahçe, notlar ve kalpler: cihazda `localStorage`; Firebase izni açıksa ayrıca `spaces/semaasistan` altında
- Hava durumu: Open-Meteo (önbelleğe alınır)
- Harita: OpenStreetMap + service worker önbelleği
- Ters konum adı: BigDataCloud

Reklam, analitik veya takip kodu yoktur.

## Dosya yapısı

```text
index.html
manifest.webmanifest
sw.js
firebase.json
.firebaserc
database.rules.json
assets/
  css/styles.css
  js/
    app.js              # ekranlar, canlı konum, olaylar
    data.js             # ders programı, palet
    firebase-config.js  # Firebase yapılandırması ve ortak alan
    icons.js            # SVG ikonlar ve hava durumu çizimleri
    state.js            # localStorage ve durum modeli
    sync.js             # Firebase Realtime Database REST
    tilemap.js          # bağımlılıksız harita
    time.js             # tarih/saat ve ders durumu
    utils.js
    weather.js          # Open-Meteo ve ters konum
icons/                  # PWA ve Apple ikonları
```

## Notlar

- Service worker sürümü `sw.js` içindeki `VERSION` değeridir. Yeni yayında bunu artırın; eski önbellek temizlenir. (Şu an: `sema-v1.1.4`)
- Uygulama dış font veya JS çatısı kullanmaz.
- Harita için OSM karoları kullanılır; yoğun kullanımda kendi tile sağlayıcına geçmek daha doğru olur.
