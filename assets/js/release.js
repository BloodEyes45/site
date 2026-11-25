import { escapeHtml } from './utils.js';

const RELEASE_KEY = 'sema-release-seen';

export const RELEASE = {
  id: '1.2.0',
  title: 'Sema 1.2',
  subtitle: 'Notlar, hatırlatıcı ve daha sakin bir harita.',
  items: [
    {
      title: 'Notlar sekmesi',
      text: 'El yazısı görünümlü metin notları ve Apple Pencil ile basınçlı mürekkep notları. Her not cihazında saklanır.',
      icon: '✎',
    },
    {
      title: 'Ders hatırlatıcısı',
      text: 'Dersten 5–30 dakika önce uygulama içi uyarı; izin verirsen telefon bildirimi.',
      icon: '◔',
    },
    {
      title: 'Canlı konum düzeltmesi',
      text: 'Harita artık her konum güncellemesinde sökülüp yeniden kurulmuyor; titreme ve boş harita bitti.',
      icon: '⌖',
    },
    {
      title: 'Biz’de notlar ve akvaryum',
      text: 'Küçük notlar ve birlikte beslediğiniz ortak akvaryum aynı alanda. Yem verin, temizleyin, inciyle yeni balıklar ekleyin.',
      icon: '♡',
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
