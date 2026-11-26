import { escapeHtml } from './utils.js';

const RELEASE_KEY = 'sema-release-seen';

export const RELEASE = {
  id: '1.7.0',
  title: 'Sema 1.7',
  subtitle: 'Yeni akvaryum temaları, yönlü geçişler ve ana ekran kısayolları.',
  items: [
    {
      title: 'Kar ve Uzay temaları',
      text: 'Akvaryuma iki yeni tema geldi: soğuk mavilerde yavaşça yağan kar ve mor bir uzayda yıldız tozu. Tüm temalar artık hareket eden katmanlı gradyanlarla geliyor.',
      icon: '❄',
    },
    {
      title: 'Yönlü sekme geçişi',
      text: 'Sekmeler arasında içerik artık kayarak geliyor: ileri giderken sağdan, geri dönerken soldan.',
      icon: '⇄',
    },
    {
      title: 'Hava durumu dokunuşu',
      text: 'Hava durumu küresine dokunduğunda orb içinde kısa bir yağmur, kar, güneş veya ay animasyonu oynuyor.',
      icon: '☀',
    },
    {
      title: 'Kaydırmada küçülen başlık',
      text: 'Sayfa aşağı indikçe karşılama başlığı küçülüyor ve üst çubuk sabitlenip adını gösteriyor.',
      icon: '⌄',
    },
    {
      title: 'Ana ekran kısayolları',
      text: 'Uygulama ikonuna basılı tutunca Bugün, Dersler ve Yeni not kısayolları çıkıyor.',
      icon: '⌘',
    },
  ],
};

export function releasePending() {
  try {
    return localStorage.getItem(RELEASE_KEY) !== RELEASE.id;
  } catch {
    return true;
  }
}

export function markReleaseSeen() {
  try {
    localStorage.setItem(RELEASE_KEY, RELEASE.id);
  } catch {
    // Depolama kapalıysa bir sonraki açılışta tekrar denenir.
  }
}

export function releaseSheetContent() {
  return `
    <div class="release">
      <h2 class="release__title">${escapeHtml(RELEASE.title)}</h2>
      <p class="release__sub">${escapeHtml(RELEASE.subtitle)}</p>
      <ul class="release__list">
        ${RELEASE.items
          .map(
            (item) => `
              <li class="release__item">
                <span class="release__icon" aria-hidden="true">${item.icon}</span>
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.text)}</p>
                </div>
              </li>`,
          )
          .join('')}
      </ul>
      <button class="primary release__cta" data-sheet-close>Başlayalım</button>
      <p class="release__once">Bu ekran yalnızca bir kez gösterilir.</p>
    </div>`;
}

export function openReleaseSheet(openSheet) {
  const sheet = openSheet?.({
    title: 'Neler yeni',
    kind: 'release',
    content: releaseSheetContent(),
    onClose: () => markReleaseSeen(),
  });
  // Okuyup okumadığından bağımsız olarak bir daha gösterilmesin.
  markReleaseSeen();
  return sheet;
}
