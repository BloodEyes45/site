# Sema — Günün Ritmi

Sema için hazırlanmış, telefonda kullanılmak üzere tasarlanmış bir **PWA**. Saf HTML, CSS ve JavaScript ile çalışır; derleme adımı yoktur.

Açık tema varsayılandır. Sağ üstteki güneş/ay düğmesiyle koyu temaya geçilebilir. Arayüz Apple'ın liquid-glass dilinden ilham alır: yumuşak ışık, yarı saydam cam katmanlar, yuvarlatılmış yüzeyler ve sakin bir renk paleti.

## Neler var?

- **Bugün:** Saate göre “Günaydın / İyi akşamlar” karşılaması, tarih, canlı saat, anlık hava durumu, ders hatırlatıcısı zili.
- **Canlı konum:** `watchPosition` ile bulunduğun yer otomatik takip edilir. Harita artık her konum/hava güncellemesinde yeniden kurulmaz; karolar yeniden kullanılır.
- **Hava durumu:** Karta dokununca saatlik ve 7 günlük tahmin. Open-Meteo kullanılır.
- **Dinamik gökyüzü:** Ana sayfa gerçek hava durumuna göre değişir.
- **Harita:** Canlı konumun işaretlendiği, sürüklenebilir ve yakınlaştırılabilir harita. OpenStreetMap, yüklenemezse CARTO yedeği.
- **Ders programı:** Pazartesi'den Pazar'a gün gün gezinme, ders ekleme, düzenleme ve silme.
- **Notlar:** İki modlu kişisel defter.
  - **El yazısı notu:** Metin, kendi barındırılan *Caveat* fontuyla el yazısı gibi görünür. iPad'de Apple Pencil ile bu alana yazınca iPadOS Scribble el yazını metne çevirir; metin yine el yazısı görünümünde kalır.
  - **Mürekkep notu:** Apple Pencil'ın basınç ve eğimini kullanan gerçek çizim. Kalem, fosforlu, silgi, 5 renk, geri al/yinele, temizle ve PNG dışa aktarma.
  - Notlar `IndexedDB` içinde saklanır; mürekkep vektör olarak tutulur, listede küçük önizleme görünür.
- **Biz:** Eşinle birbirinize bıraktığınız **küçük notlar** ve birlikte beslediğiniz **ortak akvaryum**; iki cihazda ortak tutulur.
- **PWA:** Ana ekrana ekleme, tam ekran açılış, çevrimdışı uygulama kabuğu.

### Apple Pencil hakkında dürüst sınır

- **Metne dönüşüm** yalnızca metin alanında çalışır: iPadOS Scribble, sistem dili desteklenen bir dildeyse (Türkçe dahil) Apple Pencil yazısını otomatik metne çevirir. Ayarlar → Apple Pencil → Scribble açık olmalı.
- **Canvas mürekkebi** Safari'de cihaz üzerinde metne çevrilemez; Apple'ın tanıma motoru (PencilKit) yalnızca yerel uygulamalara açıktır. Bu yüzden mürekkep notu aranabilir metin değildir; istersen PNG olarak dışa aktarılır. Bulut OCR eklemek API anahtarı ve notların cihazdan çıkması demektir, bu sürümde yok.
- iPadOS Scribble bazen canvas çizimlerini kesebilir. Mürekkep modunda sorun olursa Ayarlar → Apple Pencil → Scribble'ı geçici kapat.

## Ders hatırlatıcısı

- Bugün ekranındaki **zil** düğmesi ayarları açar: aç/kapa, 5 / 10 / 15 / 30 dakika önce.
- Uygulama açıkken uyarı her durumda çalışır (üstte kalıcı kart + hafif titreşim). Aynı ders için günde bir kez gösterilir.
- **Telefon bildirimi** için izin verilmesi gerekir. iPhone/iPad'de önce Paylaş → **Ana Ekrana Ekle** ile uygulamayı yükle.
- Uygulama kapalıyken bildirim, GitHub Actions üzerinde 5 dakikada bir çalışan `push-worker` ile gönderilir. **Blaze planı veya Firebase CLI gerekmez.**

### Telefon bildirimi kurulumu (tek sefer)

> Bu yöntem GitHub’ı kullanır. Repo **public** ise Actions dakikaları ücretsizdir; private repoda aylık dakika sınırına dikkat et.

1. GitHub’da repoyu aç → **Settings → Secrets and variables → Actions → New repository secret**.
2. Bilgisayarda `D:\OneDrive\Desktop\Deneme\.secrets\vapid.json` dosyasını aç (`notepad .secrets\vapid.json`). İçindeki **`privateKey`** değerini kopyala.
3. Secret adı: **`VAPID_PRIVATE_KEY`**, değer: kopyaladığın anahtar. Kaydet. (İsteğe bağlı `VAPID_SUBJECT` ekleyebilirsin; boş bırakılırsa `mailto:sema@example.com` kullanılır.)
4. **Actions** sekmesinde **Ders hatırlatıcıları** iş akışını aç → **Run workflow** ile bir kez elle çalıştır. Sonraki çalışmalar 5 dakikada bir otomatiktir.
5. Uygulamada **Bugün → zil → Telefon bildirimi → Aç** ve izin ver. “Deneme bildirimi gönder” ile kontrol et.

İstemci, cihaz aboneliğini ve ders programını `spaces/semaasistan/push/...` altına yazar; GitHub Actions `push-worker/cron.mjs` ile yaklaşan dersleri bulup Web Push gönderir ve gönderilenleri `push/sent/...` altında işaretler. GitHub zamanlayıcısı birkaç dakika gecikebilir; bu yüzden bildirim “tam dakikasında” değil, o aralıkta gelebilir.

> `.secrets/vapid.json` **özel anahtar** içerir ve `.gitignore` ile repo dışında tutulur. Bu dosyayı GitHub’a, siteye veya sohbete yükleme. Daha önce eski `functions/.vapid.json` dosyasını push ettiysen, artık kullanılmayan eski anahtarı geçmişten silmek için repo geçmişini temizle; yeni anahtar çifti bu sürümde yeniden üretildi.

## Biz

- **Küçük notlar:** Eşinle birbirinize kısa notlar bırakırsınız; notlar sohbet gibi alt alta listelenir.
- **Ortak akvaryum:** İki başlangıç balığıyla başlar. Her 6 saatte bir yem verebilir, her 12 saatte bir temizleyebilirsiniz; her bakım 1 inci kazandırır. İncilerle 4 yeni balık türü açılır, üç tema arasından seçim yapılır. İkiniz de aynı akvaryumu görür ve besleyebilirsiniz.
- Notlar ve akvaryum Firebase Realtime Database üzerinden ortak tutulur; Biz sekmesi açıkken 3 saniyede bir eşitlenir. Bağlantı yoksa notlar cihazda saklanır, akvaryum için bağlantı gerekir.

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

Yeni ders eklerken gün, başlangıç, bitiş ve yer bilgisi girilir; çakışan saat aralıkları engellenir. Dersler değiştiğinde hatırlatıcı programı buluta yeniden yazılır.

## Çalıştırma

Service worker ve PWA özellikleri için siteyi `file://` ile değil, küçük bir yerel sunucuyla aç:

```bash
python -m http.server 8791
```

Sonra:

```text
http://localhost:8791
```

Telefonda PWA olarak kurmak için sitenin **HTTPS** üzerinden yayınlanması gerekir. Konum izni de HTTPS (veya localhost) gerektirir.

### GitHub Pages ile yayınlama

`.github/workflows/pages.yml` yalnızca `index.html`, `manifest.webmanifest`, `sw.js`, `assets/` ve `icons/` klasörlerini yayınlar; `push-worker/`, `.secrets/` ve yapılandırma dosyaları siteye çıkmaz.

1. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. `main` (veya `master`) dalına push et. **GitHub Pages** iş akışı siteyi yayınlar.
3. Adres: `https://KULLANICI.github.io/REPO/`. Telefonda bu adresi açıp ana ekrana ekle.

## Firebase

Firebase yapılandırması doğrudan [firebase-config.js](assets/js/firebase-config.js) içinde gömülüdür:

```text
Proje: semaasistan-9dca3
Veritabanı: https://semaasistan-9dca3-default-rtdb.firebaseio.com
Ortak alan: spaces/semaasistan
```

Eşleşme kodu veya URL girişi yoktur. İki cihaz da aynı uygulamayı açtığında aynı ortak alanı kullanır. Web Push açık anahtarı (`vapidPublicKey`) aynı dosyadadır; gizli değildir.

### Veritabanı kuralları

`spaces/semaasistan` şu an herkese açık okuma/yazmaya izin verir:

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

Bu, ortak alanı ve push abonelik uç noktalarını bilen herkese açık hale getirir. Kişisel kullanım için pratiktir; hassas bilgi paylaşmayın. Daha sıkı bir kurulum için Firebase Authentication gerekir.

## Veriler nerede tutulur?

- Profil, dersler, tema, hatırlatıcı tercihi ve son konum: `localStorage`
- Notlar ve mürekkep çizimleri: `IndexedDB` (`sema-notes`); desteklenmezse `localStorage` yedeği
- Ortak notlar, akvaryum durumu ve push aboneliği: cihazda `localStorage`; Firebase izni açıksa `spaces/semaasistan` altında
- Hava durumu: Open-Meteo (önbelleğe alınır)
- Harita: OpenStreetMap + CARTO yedeği, service worker önbelleği
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
  fonts/                # Caveat (OFL) + lisans
  js/
    app.js              # ekranlar, canlı konum, harita, olaylar
    data.js             # ders programı, palet
    firebase-config.js  # Firebase yapılandırması, ortak alan, VAPID açık anahtarı
    icons.js            # SVG ikonlar ve hava durumu çizimleri
    ink.js              # Apple Pencil basınçlı mürekkep motoru
    aquarium.js         # ortak akvaryum oyunu
    notes.js            # notlar, IndexedDB, editör
    release.js          # tek seferlik sürüm notu
    reminders.js        # ders hatırlatıcısı ve Web Push aboneliği
    state.js            # localStorage ve durum modeli
    sync.js             # Firebase Realtime Database REST
    tilemap.js          # bağımlılıksız harita
    time.js             # tarih/saat ve ders durumu
    utils.js
    weather.js          # Open-Meteo ve ters konum
.github/workflows/      # GitHub Pages + ders hatırlatıcıları
push-worker/            # GitHub Actions Web Push zamanlayıcısı
.secrets/               # VAPID özel anahtarı (gitignore, yayınlanmaz)
icons/                  # PWA ve Apple ikonları
```

## Notlar

- Service worker sürümü `sw.js` içindeki `VERSION` değeridir. Yeni yayında bunu artırın; eski önbellek temizlenir. (Şu an: `sema-v1.5.3`)
- Sürüm notu ekranı `release.js` içindeki `RELEASE.id` ile `localStorage` anahtarına bağlıdır; bir kez gösterildikten sonra tekrar açılmaz.
- Uygulama dış JS çatısı kullanmaz. Tek dış font `assets/fonts/` altındaki Caveat'tır (SIL Open Font License).
- Harita için OSM karoları, yüklenemezse CARTO kullanılır; yoğun kullanımda kendi tile sağlayıcına geçmek daha doğru olur.
- GitHub Actions gizli anahtarı yoksa “Telefon bildirimi” aboneliği buluta yazılamaz; önce `VAPID_PRIVATE_KEY` secret’ını ekle.
- `.secrets/vapid.json` özel anahtarı içerir; `.gitignore` dışına çıkarma. GitHub Pages iş akışı yalnızca site dosyalarını yayınladığı için bu dosya sitede görünmez.
- GitHub Actions zamanlayıcısı yoğun saatlerde birkaç dakika gecikebilir; bildirim ders saatinden hemen önce değil, seçtiğin aralıkta gelebilir.
