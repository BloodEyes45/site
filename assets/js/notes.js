import { createId } from './state.js';
import { escapeHtml, formatRelativeTime } from './utils.js';
import { InkSurface, INK_COLORS } from './ink.js';

const DB_NAME = 'sema-notes';
const STORE = 'notes';
const FALLBACK_KEY = 'sema-notes-fallback-v1';

let dbPromise = null;
let cache = [];
let ready = false;
let filter = 'all';
let search = '';
let activeEditor = null;

function hasIndexedDb() {
  try {
    return Boolean(window.indexedDB);
  } catch {
    return false;
  }
}

function openDb() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB yok'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Not defteri açılamadı'));
  });
  return dbPromise;
}

function fallbackRead() {
  try {
    const raw = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function fallbackWrite(notes) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(notes));
  } catch {
    // Depolama doluysa sessizce devam et.
  }
}

async function readAll() {
  if (!hasIndexedDb()) return fallbackRead();
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallbackRead();
  }
}

async function writeRecord(record) {
  if (!hasIndexedDb()) {
    const notes = fallbackRead();
    const index = notes.findIndex((note) => note.id === record.id);
    if (index >= 0) notes[index] = record;
    else notes.push(record);
    fallbackWrite(notes);
    return;
  }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const notes = fallbackRead().filter((note) => note.id !== record.id);
    notes.push(record);
    fallbackWrite(notes);
  }
}

async function removeRecord(id) {
  if (!hasIndexedDb()) {
    fallbackWrite(fallbackRead().filter((note) => note.id !== id));
    return;
  }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    fallbackWrite(fallbackRead().filter((note) => note.id !== id));
  }
}

function normalizeNote(raw) {
  return {
    id: String(raw.id || createId('n_')),
    title: String(raw.title || '').slice(0, 120),
    mode: raw.mode === 'ink' ? 'ink' : 'text',
    text: String(raw.text || ''),
    strokes: Array.isArray(raw.strokes) ? raw.strokes : [],
    thumb: typeof raw.thumb === 'string' ? raw.thumb : '',
    pinned: Boolean(raw.pinned),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

export async function initNotes() {
  const notes = await readAll();
  cache = notes.map(normalizeNote).sort(sortNotes);
  ready = true;
  return cache;
}

function sortNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt - a.updatedAt;
}

export function notesLoaded() {
  return ready;
}

export function getNotes() {
  return [...cache];
}

export function getNote(id) {
  return cache.find((note) => note.id === id) || null;
}

export function notesSetFilter(value) {
  filter = ['all', 'text', 'ink', 'pinned'].includes(value) ? value : 'all';
}

export function notesSetSearch(value) {
  search = String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function searchBlob(note) {
  return `${note.title} ${note.text}`.toLocaleLowerCase('tr-TR');
}

export function visibleNotes() {
  return cache.filter((note) => {
    if (filter === 'text' && note.mode !== 'text') return false;
    if (filter === 'ink' && note.mode !== 'ink') return false;
    if (filter === 'pinned' && !note.pinned) return false;
    if (search && !searchBlob(note).includes(search)) return false;
    return true;
  });
}

function noteTitle(note) {
  if (note.title) return note.title;
  const firstLine = String(note.text || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine) return firstLine.slice(0, 70);
  return note.mode === 'ink' ? 'El yazısı notu' : 'İsimsiz not';
}

function notePreview(note) {
  if (note.mode === 'ink') return '';
  const text = String(note.text || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 150);
}

function countLabel() {
  const total = cache.length;
  if (!total) return 'Henüz not yok';
  const pinned = cache.filter((note) => note.pinned).length;
  return `${total} not${pinned ? ` · ${pinned} sabit` : ''}`;
}

function cardHtml(note) {
  const preview = notePreview(note);
  return `
    <button class="note-tile ${note.mode === 'ink' ? 'note-tile--ink' : ''}" data-action="open-note" data-id="${escapeHtml(note.id)}" aria-label="${escapeHtml(noteTitle(note))} notunu aç">
      <span class="note-tile__top">
        <span class="note-tile__badge">${note.mode === 'ink' ? 'mürekkep' : 'el yazısı'}</span>
        <span class="note-tile__pin">${note.pinned ? 'sabit' : ''}</span>
      </span>
      ${
        note.mode === 'ink' && note.thumb
          ? `<span class="note-tile__thumb"><img src="${note.thumb}" alt="" loading="lazy" /></span>`
          : `<span class="note-tile__paper"><span class="note-tile__title">${escapeHtml(noteTitle(note))}</span>${preview ? `<span class="note-tile__preview">${escapeHtml(preview)}</span>` : ''}</span>`
      }
      <span class="note-tile__foot">
        <span>${formatRelativeTime(note.updatedAt)}</span>
        <span>${note.pinned ? '★' : ''}</span>
      </span>
    </button>`;
}

export function notesListHtml() {
  const notes = visibleNotes();
  const chips = [
    { id: 'all', label: 'Tümü' },
    { id: 'text', label: 'El yazısı' },
    { id: 'ink', label: 'Mürekkep' },
    { id: 'pinned', label: 'Sabit' },
  ];

  return `
    <div class="notes-chips" role="tablist" aria-label="Notları süz">
      ${chips
        .map(
          (chip) => `
            <button class="filter-chip ${filter === chip.id ? 'is-active' : ''}" role="tab" aria-selected="${filter === chip.id}"
              data-action="notes-filter" data-filter="${chip.id}">${chip.label}</button>`,
        )
        .join('')}
    </div>
    ${
      notes.length
        ? `<div class="notes-grid">${notes.map(cardHtml).join('')}</div>`
        : `<div class="empty-state notes-empty">
            <div class="empty-state__icon">${search ? '⌕' : '✎'}</div>
            <h3>${search ? 'Eşleşen not yok' : 'Burası henüz boş'}</h3>
            <p>${
              search
                ? 'Başka bir kelimeyle ara veya süzgeci değiştir.'
                : 'El yazısı gibi görünen bir metin notu ya da Apple Pencil ile gerçek mürekkep notu oluştur.'
            }</p>
            ${
              search
                ? ''
                : `<div class="notes-empty__actions">
                    <button class="primary" data-action="new-note" data-mode="text">El yazısı notu</button>
                    <button class="secondary" data-action="new-note" data-mode="ink">Mürekkep notu</button>
                  </div>`
            }
          </div>`
    }`;
}

export function notesPageHtml() {
  return `
    <div class="notes-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Kişisel defter</p>
          <h1>Notlar</h1>
          <p class="page-head__sub">${escapeHtml(countLabel())}</p>
        </div>
        <div class="page-head__actions">
          <button class="round-btn round-btn--accent" data-action="new-note" data-mode="ink" aria-label="Mürekkep notu oluştur">✎</button>
          <button class="round-btn" data-action="new-note" data-mode="text" aria-label="El yazısı notu oluştur">＋</button>
        </div>
      </header>

      <label class="notes-search">
        <span class="notes-search__icon">⌕</span>
        <input type="search" placeholder="Notlarında ara" data-notes-search value="${escapeHtml(search)}" autocomplete="off" />
      </label>

      <div id="notesList">${notesListHtml()}</div>
    </div>`;
}

export function refreshNotesList() {
  const container = document.querySelector('#notesList');
  if (container) container.innerHTML = notesListHtml();
}

function emptyNote(mode = 'text') {
  const now = Date.now();
  return normalizeNote({
    id: createId('n_'),
    mode,
    title: '',
    text: '',
    strokes: [],
    thumb: '',
    createdAt: now,
    updatedAt: now,
  });
}

function editorHtml(note) {
  const isInk = note.mode === 'ink';
  return `
    <div class="note-editor" data-note-editor data-mode="${note.mode}">
      <div class="note-editor__top">
        <button class="note-editor__back" type="button" data-sheet-close aria-label="Notları kapat">‹</button>
        <div class="note-editor__status" data-note-status>${
          note.title || note.text.trim() || (note.strokes || []).length
            ? `${escapeHtml(formatRelativeTime(note.updatedAt))} kaydedildi`
            : 'Yeni not'
        }</div>
        <div class="note-editor__actions">
          <button class="note-icon-btn" type="button" data-note-action="pin" aria-label="Notu sabitle" aria-pressed="${note.pinned}">★</button>
          <button class="note-icon-btn" type="button" data-note-action="delete" aria-label="Notu sil">🗑</button>
        </div>
      </div>

      ${
        isInk
          ? `<div class="note-ink-head">
              <input class="note-title-input note-title-input--ink" data-note-title maxlength="120" placeholder="Başlık" value="${escapeHtml(note.title)}" autocomplete="off" />
             </div>
             <div class="ink-toolbar" role="toolbar" aria-label="Çizim araçları">
              <div class="ink-tools">
                <button class="ink-tool is-active" type="button" data-ink-tool="pen" aria-label="Kalem">✒︎</button>
                <button class="ink-tool" type="button" data-ink-tool="marker" aria-label="Fosforlu kalem">▤</button>
                <button class="ink-tool" type="button" data-ink-tool="eraser" aria-label="Silgi">⌫</button>
              </div>
              <div class="ink-colors">
                ${INK_COLORS.map(
                  (color, index) => `
                    <button class="ink-color ${index === 0 ? 'is-active' : ''}" type="button" data-ink-color="${color.value}"
                      style="--ink:${color.value}" aria-label="${color.label}"></button>`,
                ).join('')}
              </div>
              <div class="ink-tools ink-tools--end">
                <button class="ink-tool" type="button" data-ink-action="undo" aria-label="Geri al">↶</button>
                <button class="ink-tool" type="button" data-ink-action="redo" aria-label="Yinele">↷</button>
                <button class="ink-tool" type="button" data-ink-action="clear" aria-label="Temizle">✕</button>
              </div>
            </div>
            <div class="ink-paper">
              <canvas class="ink-canvas" data-ink-canvas data-tool="pen" aria-label="Apple Pencil ile yaz"></canvas>
              <span class="ink-paper__hint" data-ink-hint>Apple Pencil ile yaz · basınç destekli</span>
            </div>
            <div class="ink-foot">
              <label class="ink-width"><span>Uç</span><input type="range" min="1" max="7" step="0.2" value="2.6" data-ink-width /></label>
              <button class="text-link" type="button" data-ink-action="export">PNG olarak sakla</button>
            </div>`
          : `<div class="note-paper">
              <div class="note-paper__head">
                <span class="note-paper__date">${new Date(note.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span class="note-paper__mode">el yazısı</span>
              </div>
              <input class="note-title-input" data-note-title maxlength="120" placeholder="Başlık" value="${escapeHtml(note.title)}" autocomplete="off" />
              <div class="note-body" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false"
                data-note-body data-placeholder="Buraya yaz. Apple Pencil ile yazarsan iPadOS Scribble el yazını metne çevirir.">${escapeHtml(note.text)}</div>
              <div class="note-paper__foot">
                <span data-note-count>0 kelime</span>
                <span>el yazısı fontu</span>
              </div>
            </div>
            <p class="note-editor__tip">Apple Pencil ile yazdığında iPadOS Scribble metne çevirir; metin el yazısı gibi görünür. Kalemin basıncıyla gerçek mürekkep için “Mürekkep notu” oluştur.</p>`
      }
    </div>`;
}

function syncTextCount(root) {
  const body = root.querySelector('[data-note-body]');
  const count = root.querySelector('[data-note-count]');
  if (!body || !count) return;
  const words = body.innerText.trim().split(/\s+/).filter(Boolean).length;
  count.textContent = `${words} kelime`;
}

export function openNoteEditor(id = null, mode = 'text') {
  const existing = id ? getNote(id) : null;
  const note = existing ? normalizeNote(existing) : emptyNote(mode);
  const isNew = !existing;
  let surface = null;
  let saveTimer = null;
  let closed = false;
  let dirty = false;

  const sheet = window.SemaApp?.openSheet?.({
    title: '',
    kind: 'note-editor',
    variant: 'full',
    content: editorHtml(note),
    onMount: (instance) => {
      activeEditor = { note, sheet: instance, surface: null };
      const root = instance.body;
      const status = root.querySelector('[data-note-status]');
      const titleInput = root.querySelector('[data-note-title]');
      const body = root.querySelector('[data-note-body]');

      const setStatus = (text) => {
        if (status) status.textContent = text;
      };

      const collect = () => {
        const nextTitle = String(titleInput?.value || '').trim();
        const nextText = body ? body.innerText : note.text;
        const strokes = surface ? surface.getStrokes() : note.strokes;
        return { ...note, title: nextTitle, text: nextText, strokes };
      };

      const persist = async ({ silent = false } = {}) => {
        if (closed) return;
        const record = collect();
        const empty = !record.title && !record.text.trim() && !(record.strokes || []).length;
        if (empty && isNew) {
          if (!silent) setStatus('Yazmaya başla');
          return;
        }
        record.updatedAt = Date.now();
        if (surface) record.thumb = surface.isEmpty() ? '' : surface.thumbnail();
        if (record.mode === 'ink') record.text = '';
        Object.assign(note, record);
        await writeRecord(record);
        const index = cache.findIndex((item) => item.id === record.id);
        if (index >= 0) cache[index] = record;
        else cache.push(record);
        cache.sort(sortNotes);
        dirty = false;
        if (!silent) setStatus('Kaydedildi');
        refreshNotesList();
        return record;
      };

      const scheduleSave = () => {
        dirty = true;
        setStatus('Kaydediliyor…');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => persist(), 650);
      };

      if (note.mode === 'ink') {
        const canvas = root.querySelector('[data-ink-canvas]');
        surface = new InkSurface(canvas, {
          strokes: note.strokes,
          color: INK_COLORS[0].value,
          width: 2.6,
          onChange: () => {
            scheduleSave();
            const hint = root.querySelector('[data-ink-hint]');
            if (hint) hint.classList.add('is-hidden');
          },
        });
        activeEditor.surface = surface;

        root.querySelectorAll('[data-ink-tool]').forEach((button) => {
          button.addEventListener('click', () => {
            surface.setTool(button.dataset.inkTool);
            root.querySelectorAll('[data-ink-tool]').forEach((item) => {
              item.classList.toggle('is-active', item === button);
            });
          });
        });

        root.querySelectorAll('[data-ink-color]').forEach((button) => {
          button.addEventListener('click', () => {
            surface.setColor(button.dataset.inkColor);
            root.querySelectorAll('[data-ink-color]').forEach((item) => {
              item.classList.toggle('is-active', item === button);
            });
          });
        });

        root.querySelector('[data-ink-width]')?.addEventListener('input', (event) => {
          surface.setWidth(event.target.value);
        });

        root.querySelectorAll('[data-ink-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const action = button.dataset.inkAction;
            if (action === 'undo') surface.undo();
            if (action === 'redo') surface.redo();
            if (action === 'clear') surface.clear();
            if (action === 'export') {
              const record = await persist();
              if (!record) return;
              const link = document.createElement('a');
              link.href = surface.toDataUrl();
              link.download = `${(record.title || 'sema-notu').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'sema-notu'}.png`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setStatus('PNG indirildi');
            }
          });
        });

        root.querySelector('[data-note-action="pin"]')?.addEventListener('click', async (event) => {
          note.pinned = !note.pinned;
          event.currentTarget.setAttribute('aria-pressed', String(note.pinned));
          await persist({ silent: true });
          setStatus(note.pinned ? 'Sabitlendi' : 'Sabitleme kaldırıldı');
        });

        root.querySelector('[data-note-action="delete"]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          if (button.dataset.armed !== '1') {
            button.dataset.armed = '1';
            button.textContent = 'onayla';
            return;
          }
          await removeNote(note.id);
          closed = true;
          sheet.close();
        });
      } else {
        body?.addEventListener('input', () => {
          scheduleSave();
          syncTextCount(root);
        });
        syncTextCount(root);
        requestAnimationFrame(() => {
          if (isNew) body?.focus();
          else body?.blur();
        });

        root.querySelector('[data-note-action="pin"]')?.addEventListener('click', async (event) => {
          note.pinned = !note.pinned;
          event.currentTarget.setAttribute('aria-pressed', String(note.pinned));
          await persist({ silent: true });
          setStatus(note.pinned ? 'Sabitlendi' : 'Sabitleme kaldırıldı');
        });

        root.querySelector('[data-note-action="delete"]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          if (button.dataset.armed !== '1') {
            button.dataset.armed = '1';
            button.textContent = 'onayla';
            return;
          }
          await removeNote(note.id);
          closed = true;
          sheet.close();
        });
      }

      titleInput?.addEventListener('input', scheduleSave);

      // Sayfa kapanırken son hâli kaydet.
      const originalClose = instance.onClose;
      instance.onClose = async () => {
        clearTimeout(saveTimer);
        if (!closed) await persist({ silent: true });
        originalClose?.();
      };
    },
    onClose: () => {
      activeEditor = null;
      surface?.destroy();
      surface = null;
      refreshNotesList();
    },
  });

  return sheet;
}

export async function removeNote(id) {
  await removeRecord(id);
  cache = cache.filter((note) => note.id !== id);
  refreshNotesList();
}

export function closeNoteEditor() {
  if (activeEditor?.sheet) activeEditor.sheet.close();
  activeEditor = null;
}
