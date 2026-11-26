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
- Uygulama kapalıyken bildirim, Netlify üzerinde 5 dakikada bir çalışan zamanlanmış fonksiyon (`netlify/functions/reminders.mjs`) ile gönderilir. **Blaze planı, Firebase CLI veya GitHub gerekmez.**

### Telefon bildirimi kurulumu (tek sefer)

> Gönderen taraf Netlify’ın **zamanlanmış fonksiyonu**. Ücretsiz plana dahildir; 5 dakikada bir çalışır ve her çalışma saniyeler sürer.

1. Bilgisayarda `.secrets\netlify.env` dosyasını aç (`notepad .secrets\netlify.env`). İçinde üç satır var: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
2. Netlify’da siteyi aç → **Site configuration → Environment variables → Import from a .env file** → bu dosyayı yükle (ya da üç değişkeni elle ekle). Kaydet ve değişkenleri **secret** olarak işaretle.
3. **Deploys → Trigger deploy → Deploy site** ile yeniden yayınla; ortam değişkenleri yeni deploy’da devreye girer.
4. **Functions** sekmesinde `reminders` fonksiyonunu aç → **Run now**. Günlükte `[19:24] 8 ders, 0 cihaz` benzeri bir satır görürsün; sonrası otomatiktir (`*/5 * * * *`).
5. Uygulamada **Bugün → zil → Telefon bildirimi → Aç** ve izin ver. “Deneme bildirimi gönder” ile kontrol et.

İstemci, cihaz aboneliğini ve ders programını `spaces/semaasistan/push/...` altına yazar; Netlify fonksiyonu yaklaşan dersleri bulup Web Push gönderir ve gönderilenleri `push/sent/...` altında işaretler. Zamanlayıcı birkaç dakika gecikebilir; bu yüzden bildirim “tam dakikasında” değil, o aralıkta gelebilir.

> `.secrets/vapid.json` ve `.secrets/netlify.env` **özel anahtar** içerir ve `.gitignore` ile repo dışında tutulur. Bu dosyaları GitHub’a, siteye veya sohbete yükleme. Anahtarlar kaybolursa yeni çift üretilir, `firebase-config.js` içindeki açık anahtar güncellenir ve telefonda bildirimi bir kez kapatıp açmak yeterlidir; eski abonelik otomatik yenilenir.

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

### Netlify ile yayınlama

`netlify.toml` yalnızca site dosyalarını yayınlar: `node scripts/build-site.mjs` komutu `index.html`, `manifest.webmanifest`, `sw.js`, `assets/` ve `icons/` klasörlerini `dist` içine toplar. `push-worker/`, `.secrets/`, `.github/` ve yapılandırma dosyaları siteye çıkmaz.

**A. Sürükle-bırak (yalnızca site, Git gerekmez)**

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**.
2. Bilgisayarda `npm run build` çalıştır.
3. Netlify'ın sürükle-bırak alanına **`dist` klasörünü** bırak. Site saniyeler içinde `https://SITE-ADI.netlify.app` adresinde yayınlanır.
4. Sonraki güncellemeler için aynı adımı tekrarla (**Deploys → Deploy manually**).

> Yalnızca `dist` klasörünü yükle. Klasörün tamamını yüklersen `.secrets/` ve `push-worker/` de siteye çıkar.
>
> Sürükle-bırak **yalnızca siteyi** yayınlar; zamanlanmış bildirim fonksiyonu yüklenmez. Telefon bildirimlerinin de çalışması için **B** veya **C** yolunu kullan.

**B. Netlify CLI ile (önerilen, Git gerekmez)**

```bash
npx netlify login
npx netlify deploy --build --prod
```

İlk çalıştırmada “Link this directory to an existing site?” sorusuna yeni site oluşturarak yanıtla. `--build` sayesinde `dist` yeniden üretilir ve fonksiyon bağımlılıkları (`web-push`) Netlify tarafında paketlenir.

**C. Git ile (isteğe bağlı)**

Repoyu GitHub/GitLab/Bitbucket'a bağlarsan Netlify her push'ta `node scripts/build-site.mjs` çalıştırıp yayınlar.

Telefonda adresi aç → Paylaş → **Ana Ekrana Ekle**.

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
netlify.toml
package.json
firebase.json
.firebaserc
database.rules.json
netlify/functions/reminders.mjs   # 5 dakikalık Web Push zamanlayıcısı
scripts/build-site.mjs           # dist/ üretir (yalnızca site dosyaları)
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
.github/workflows/      # eski GitHub akışı (Netlify kullanılıyorsa gerekmez)
push-worker/            # GitHub Actions alternatifi (aynı cron mantığı)
.secrets/               # VAPID anahtarları + netlify.env (gitignore, yayınlanmaz)
icons/                  # PWA ve Apple ikonları
```

## Notlar

- Service worker sürümü `sw.js` içindeki `VERSION` değeridir. Yeni yayında bunu artırın; eski önbellek temizlenir. (Şu an: `sema-v1.5.8`)
- Sürüm notu ekranı `release.js` içindeki `RELEASE.id` ile `localStorage` anahtarına bağlıdır; bir kez gösterildikten sonra tekrar açılmaz.
- Uygulama dış JS çatısı kullanmaz. Tek dış font `assets/fonts/` altındaki Caveat'tır (SIL Open Font License).
- Harita için OSM karoları, yüklenemezse CARTO kullanılır; yoğun kullanımda kendi tile sağlayıcına geçmek daha doğru olur.
- Netlify ortam değişkenleri (`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`) yoksa “Telefon bildirimi” aboneliği buluta yazılamaz; önce **Site configuration → Environment variables** adımını tamamla.
- `.secrets/` özel anahtarı içerir; `.gitignore` dışına çıkarma. Netlify build'i yalnızca `dist` klasörünü yayınladığı için bu dosyalar sitede görünmez.
- Netlify zamanlayıcısı yoğun saatlerde birkaç dakika gecikebilir; bildirim ders saatinden hemen önce değil, seçtiğin aralıkta gelebilir.
- GitHub'a da push edeceksen `.github/workflows/lesson-reminders.yml` dosyasını sil; yoksa aynı bildirim iki yerden gönderilmeye çalışılır (Firebase'deki `push/sent` işareti çoğu durumda ikinciyi engeller).
