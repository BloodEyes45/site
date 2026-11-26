import { cloudEnabled, patchNode, readNode, writeNode } from './sync.js';

const SPECIES = [
  { id: 'clown', emoji: '🐠', name: 'Palyaço', cost: 0 },
  { id: 'blue', emoji: '🐟', name: 'Mavi', cost: 0 },
  { id: 'puffer', emoji: '🐡', name: 'Balon', cost: 2 },
  { id: 'turtle', emoji: '🐢', name: 'Kaplumbağa', cost: 4 },
  { id: 'shrimp', emoji: '🦐', name: 'Karides', cost: 6 },
  { id: 'octopus', emoji: '🐙', name: 'Ahtapot', cost: 8 },
];

const THEMES = [
  { id: 'lagoon', label: 'Lagün' },
  { id: 'sunset', label: 'Gün batımı' },
  { id: 'deep', label: 'Derin' },
  { id: 'snow', label: 'Kar' },
  { id: 'space', label: 'Uzay' },
];

const FEED_COOLDOWN = 6 * 60 * 60 * 1000;
const CLEAN_COOLDOWN = 12 * 60 * 60 * 1000;
const POLL_INTERVAL = 3000;
const CLOCK_INTERVAL = 30000;

let aquarium = null;
let pollTimer = null;
let clockTimer = null;
let busy = false;
let effect = '';
let lastError = '';

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const fish = {};
  for (const [id, item] of Object.entries(value.fish || {})) {
    if (item?.species && SPECIES.some((species) => species.id === item.species)) {
      fish[id] = { ...item, id };
    }
  }
  const events = value.events && typeof value.events === 'object' ? value.events : {};
  const purchases = value.purchases && typeof value.purchases === 'object' ? value.purchases : {};
  const feeds = value.feeds && typeof value.feeds === 'object' ? value.feeds : {};
  const cleans = value.cleans && typeof value.cleans === 'object' ? value.cleans : {};
  const theme = THEMES.some((item) => item.id === value.theme) ? value.theme : 'lagoon';
  return { ...value, fish, events, purchases, feeds, cleans, theme };
}

function freshAquarium() {
  const at = Date.now();
  return {
    createdAt: at,
    feeds: {},
    cleans: {},
    events: {},
    purchases: {},
    theme: 'lagoon',
    fish: {
      f_seed_clown: { species: 'clown', by: 'seed', at },
      f_seed_blue: { species: 'blue', by: 'seed', at },
    },
  };
}

function speciesById(id) {
  return SPECIES.find((species) => species.id === id) || null;
}

function pearls() {
  if (!aquarium) return 0;
  const earned = Object.values(aquarium.events || {}).filter(
    (event) => event?.type === 'feed' || event?.type === 'clean',
  ).length;
  const spent = Object.values(aquarium.purchases || {}).reduce(
    (total, purchase) => total + Number(purchase?.cost || 0),
    0,
  );
  return Math.max(0, earned - spent);
}

function careCount() {
  if (!aquarium) return 0;
  return Object.values(aquarium.events || {}).filter(
    (event) => event?.type === 'feed' || event?.type === 'clean',
  ).length;
}

function level() {
  return 1 + Math.min(4, Math.floor(careCount() / 6));
}

function remaining(timestamp, cooldown) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, value + cooldown - Date.now());
}

function formatLeft(milliseconds) {
  if (milliseconds <= 0) return 'hazır';
  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} sa ${minutes} dk`;
  return `${minutes} dk`;
}

function fishFor(species, uid, at) {
  const random = Math.random().toString(36).slice(2, 8);
  return { species, by: uid, at, id: `f_${uid}_${at}_${random}` };
}

function fishHtml(item) {
  const species = speciesById(item.species);
  if (!species) return '';
  let hash = 0;
  for (const char of String(item.id || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const top = 14 + (hash % 52);
  const duration = 18 + (hash % 12);
  const delay = -(hash % duration);
  const scale = 0.8 + (hash % 42) / 100;
  const flip = hash % 2 ? -1 : 1;
  const bob = Math.max(2.8, duration / 4).toFixed(1);
  return `<span class="aquarium-fish" style="--top:${top}%;--dur:${duration}s;--delay:${delay}s;--scale:${scale};--flip:${flip};--flip-back:${-flip};--bob:${bob}s" title="${species.name}" aria-label="${species.name}">
    <span class="aquarium-fish__body">${species.emoji}</span>
  </span>`;
}

function foodParticlesHtml() {
  return Array.from({ length: 14 }, (_, index) => {
    const start = ((index * 37) % 78) - 39;
    const drift = ((index * 53) % 64) - 32;
    const delay = (index % 5) * 0.11;
    const rotation = ((index * 47) % 120) - 60;
    return `<i style="--start:${start}%;--drift:${drift}px;--delay:${delay}s;--rot:${rotation}deg"></i>`;
  }).join('');
}

function sparkleParticlesHtml() {
  return Array.from({ length: 9 }, (_, index) => {
    const left = 8 + ((index * 29) % 84);
    const top = 12 + ((index * 37) % 62);
    const delay = (index % 6) * 0.1;
    return `<span class="aquarium-sparkle" style="--left:${left}%;--top:${top}%;--delay:${delay}s">✦</span>`;
  }).join('');
}

export function aquariumCardHtml(state) {
  if (!cloudEnabled()) {
    return `
      <section class="aquarium-panel aquarium-panel--offline">
        <div class="aquarium-offline">🌊 <p>Ortak akvaryum için bulut bağlantısı gerekli. Bağlantı gelince balıklar burada yüzecek.</p></div>
      </section>`;
  }
  if (!aquarium) {
    return `
      <section class="aquarium-panel">
        <div class="aquarium-head">
          <div><p class="eyebrow">Bizim akvaryumumuz</p><h2>Küçük dünyamız</h2></div>
        </div>
        <p class="aquarium-status">${lastError ? 'Akvaryum yüklenemedi. Bağlantıyı kontrol edip yeniden dene.' : 'Akvaryum hazırlanıyor…'}</p>
        <button class="secondary tiny" data-action="aquarium-refresh">Yenile</button>
      </section>`;
  }

  const feedLeft = remaining(aquarium.feeds?.[state.couple.uid], FEED_COOLDOWN);
  const cleanLeft = remaining(aquarium.cleans?.[state.couple.uid], CLEAN_COOLDOWN);
  const currentPearls = pearls();
  const currentLevel = level();
  const fishItems = Object.values(aquarium.fish || {});
  const owned = new Set(fishItems.map((item) => item.species));
  const status = effect === 'feed'
    ? 'Yemler suya düşüyor…'
    : effect === 'clean'
      ? 'Balıklar temiz suda yüzüyor…'
      : feedLeft > 0 && cleanLeft > 0
        ? 'Bugünkü bakımın tamam. Akvaryum ışıl ışıl.'
        : feedLeft > 0
          ? 'Yem verildi. Bir temizlikle akvaryumu parlat.'
          : cleanLeft > 0
            ? 'Akvaryum temiz. Bir yemle dostları sevindir.'
            : 'Küçük dostlar seni bekliyor. Bir yem, bir temizlik yeter.';

  return `
    <section class="aquarium-panel" aria-labelledby="aquarium-title">
      <div class="aquarium-head">
        <div>
          <p class="eyebrow">Bizim akvaryumumuz</p>
          <h2 id="aquarium-title">Küçük dünyamız</h2>
        </div>
        <div class="aquarium-stats">
          <span>🐚 <strong>${currentPearls}</strong> inci</span>
          <span>${fishItems.length} balık</span>
        </div>
      </div>

      <div class="aquarium-tank ${effect ? `is-${effect}` : ''}" data-theme="${aquarium.theme}" aria-label="Ortak akvaryum">
        <span class="aquarium-tank__caustics"></span>
        <span class="aquarium-tank__aurora" aria-hidden="true"></span>
        <span class="aquarium-tank__stars" aria-hidden="true"></span>
        <span class="aquarium-tank__water"></span>
        <span class="aquarium-tank__snow" aria-hidden="true"></span>
        <span class="aquarium-tank__light"></span>
        <span class="aquarium-tank__rock aquarium-tank__rock--1"></span>
        <span class="aquarium-tank__rock aquarium-tank__rock--2"></span>
        <span class="aquarium-tank__sand"></span>
        <span class="aquarium-tank__coral aquarium-tank__coral--1"></span>
        <span class="aquarium-tank__coral aquarium-tank__coral--2"></span>
        <span class="aquarium-tank__plant aquarium-tank__plant--1"></span>
        <span class="aquarium-tank__plant aquarium-tank__plant--2"></span>
        <span class="aquarium-tank__plant aquarium-tank__plant--3"></span>
        <span class="aquarium-tank__plant aquarium-tank__plant--4"></span>
        <span class="aquarium-tank__bubble" style="--x:14%;--s:0.8;--d:8s;--delay:-1s"></span>
        <span class="aquarium-tank__bubble" style="--x:31%;--s:1.25;--d:10s;--delay:-5s"></span>
        <span class="aquarium-tank__bubble" style="--x:48%;--s:0.65;--d:7s;--delay:-3s"></span>
        <span class="aquarium-tank__bubble" style="--x:63%;--s:1.1;--d:11s;--delay:-7s"></span>
        <span class="aquarium-tank__bubble" style="--x:78%;--s:0.75;--d:9s;--delay:-2s"></span>
        <span class="aquarium-tank__bubble" style="--x:88%;--s:1.35;--d:12s;--delay:-6s"></span>
        ${fishItems.map(fishHtml).join('')}
        ${effect === 'feed' ? `<span class="aquarium-food" aria-hidden="true">${foodParticlesHtml()}</span><span class="aquarium-tank__ripple" aria-hidden="true"></span>` : ''}
        ${effect === 'clean' ? `<span class="aquarium-sparkles" aria-hidden="true">${sparkleParticlesHtml()}</span>` : ''}
      </div>

      <p class="aquarium-status">${status}</p>

      <div class="aquarium-actions">
        <button class="primary" data-action="aquarium-feed" ${busy || feedLeft > 0 ? 'disabled' : ''}>
          🐟 Yem ver <small>${feedLeft > 0 ? formatLeft(feedLeft) : 'hazır'}</small>
        </button>
        <button class="secondary" data-action="aquarium-clean" ${busy || cleanLeft > 0 ? 'disabled' : ''}>
          🫧 Temizle <small>${cleanLeft > 0 ? formatLeft(cleanLeft) : 'hazır'}</small>
        </button>
      </div>

      <div class="aquarium-meta">
        <span>Seviye ${currentLevel}</span>
        <span>${careCount()} bakım</span>
      </div>

      <div class="aquarium-shelf">
        <div class="aquarium-shelf__head">
          <h3>Balıklar</h3>
          <span>${currentPearls} inci</span>
        </div>
        <div class="aquarium-species-list">
          ${SPECIES.map((species) => {
            const isOwned = owned.has(species.id);
            const affordable = currentPearls >= species.cost;
            return `
              <button class="aquarium-species ${isOwned ? 'is-owned' : ''}"
                data-action="aquarium-buy" data-species="${species.id}"
                ${isOwned || !affordable || busy ? 'disabled' : ''}>
                <span class="aquarium-species__emoji">${species.emoji}</span>
                <span class="aquarium-species__name">${species.name}</span>
                <span class="aquarium-species__cost">${isOwned ? 'suda' : species.cost ? `${species.cost} 🐚` : 'ücretsiz'}</span>
              </button>`;
          }).join('')}
        </div>
      </div>

      <div class="aquarium-themes" role="group" aria-label="Akvaryum teması">
        ${THEMES.map(
          (theme) => `<button class="aquarium-theme ${aquarium.theme === theme.id ? 'is-active' : ''}"
            data-action="aquarium-theme" data-theme="${theme.id}">${theme.label}</button>`,
        ).join('')}
      </div>

      <p class="aquarium-note">Her yem ve temizlik 1 inci kazandırır. İncilerle yeni dostlar ekleyin; ikiniz de aynı akvaryumu görürsünüz.</p>
    </section>`;
}

export async function refreshAquarium() {
  if (!cloudEnabled()) return null;
  aquarium = normalize(await readNode('aquarium'));
  return aquarium;
}

export async function ensureAquarium() {
  if (!cloudEnabled()) return null;
  try {
    lastError = '';
    await refreshAquarium();
    if (!aquarium) {
      await writeNode('aquarium', freshAquarium());
      await refreshAquarium();
    }
    return aquarium;
  } catch (error) {
    lastError = error?.message || 'Akvaryum yüklenemedi.';
    return aquarium;
  }
}

export async function feedAquarium(state) {
  if (!cloudEnabled() || busy) return { ok: false };
  if (!aquarium) await ensureAquarium();
  if (!aquarium) return { ok: false, error: 'Akvaryum henüz hazır değil.' };
  const left = remaining(aquarium.feeds?.[state.couple.uid], FEED_COOLDOWN);
  if (left > 0) return { ok: false, error: `Yem saatin ${formatLeft(left)} sonra dolacak.` };

  busy = true;
  try {
    const at = Date.now();
    await writeNode(`aquarium/feeds/${encodeURIComponent(state.couple.uid)}`, at);
    await patchNode('aquarium/events', {
      [`e_${state.couple.uid}_${at}`]: { type: 'feed', uid: state.couple.uid, name: state.profile.name, at },
    });
    await refreshAquarium();
    effect = 'feed';
    setTimeout(() => {
      if (effect === 'feed') {
        effect = '';
        renderAquariumInto(state);
      }
    }, 3200);
    return { ok: true };
  } catch (error) {
    lastError = error?.message || 'Yem verilemedi.';
    return { ok: false, error: lastError };
  } finally {
    busy = false;
  }
}

export async function cleanAquarium(state) {
  if (!cloudEnabled() || busy) return { ok: false };
  if (!aquarium) await ensureAquarium();
  if (!aquarium) return { ok: false, error: 'Akvaryum henüz hazır değil.' };
  const left = remaining(aquarium.cleans?.[state.couple.uid], CLEAN_COOLDOWN);
  if (left > 0) return { ok: false, error: `Temizlik saatin ${formatLeft(left)} sonra dolacak.` };

  busy = true;
  try {
    const at = Date.now();
    await writeNode(`aquarium/cleans/${encodeURIComponent(state.couple.uid)}`, at);
    await patchNode('aquarium/events', {
      [`e_${state.couple.uid}_${at}`]: { type: 'clean', uid: state.couple.uid, name: state.profile.name, at },
    });
    await refreshAquarium();
    effect = 'clean';
    setTimeout(() => {
      if (effect === 'clean') {
        effect = '';
        renderAquariumInto(state);
      }
    }, 3200);
    return { ok: true };
  } catch (error) {
    lastError = error?.message || 'Akvaryum temizlenemedi.';
    return { ok: false, error: lastError };
  } finally {
    busy = false;
  }
}

export async function buyFish(speciesId, state) {
  const species = speciesById(speciesId);
  if (!species || !cloudEnabled() || busy) return { ok: false };
  busy = true;
  try {
    await refreshAquarium();
    if (!aquarium) return { ok: false, error: 'Akvaryum henüz hazır değil.' };
    if (Object.values(aquarium.fish || {}).some((item) => item.species === species.id)) {
      return { ok: false, error: 'Bu balık zaten akvaryumda.' };
    }
    if (pearls() < species.cost) {
      return { ok: false, error: 'Yeterli inci yok. Yem vererek veya temizleyerek inci kazan.' };
    }
    const at = Date.now();
    const item = fishFor(species.id, state.couple.uid, at);
    await patchNode('aquarium/fish', { [item.id]: { species: species.id, by: state.couple.uid, at } });
    await patchNode('aquarium/purchases', {
      [`p_${item.id}`]: { species: species.id, cost: species.cost, uid: state.couple.uid, at },
    });
    await refreshAquarium();
    return { ok: true };
  } catch (error) {
    lastError = error?.message || 'Balık eklenemedi.';
    return { ok: false, error: lastError };
  } finally {
    busy = false;
  }
}

export async function setAquariumTheme(themeId) {
  if (!cloudEnabled() || !THEMES.some((theme) => theme.id === themeId)) return { ok: false };
  try {
    await writeNode('aquarium/theme', themeId);
    await refreshAquarium();
    return { ok: true };
  } catch (error) {
    lastError = error?.message || 'Tema değiştirilemedi.';
    return { ok: false, error: lastError };
  }
}

export function renderAquariumInto(state) {
  const slot = document.querySelector('#aquariumSlot');
  if (!slot) return;
  slot.innerHTML = aquariumCardHtml(state);
}

export function startAquariumPolling(state, onChange) {
  stopAquariumPolling();
  pollTimer = setInterval(async () => {
    if (document.visibilityState === 'hidden' || !cloudEnabled()) return;
    const before = JSON.stringify(aquarium);
    try {
      await refreshAquarium();
      if (JSON.stringify(aquarium) !== before) onChange?.();
    } catch {
      // Bir sonraki turda yeniden dene.
    }
  }, POLL_INTERVAL);
  clockTimer = setInterval(() => {
    if (document.visibilityState !== 'hidden') updateAquariumClock(state);
  }, CLOCK_INTERVAL);
}

function updateAquariumClock(state) {
  const slot = document.querySelector('#aquariumSlot');
  if (!slot || !aquarium) return;
  const feedLeft = remaining(aquarium.feeds?.[state.couple.uid], FEED_COOLDOWN);
  const cleanLeft = remaining(aquarium.cleans?.[state.couple.uid], CLEAN_COOLDOWN);
  for (const [action, left] of [['aquarium-feed', feedLeft], ['aquarium-clean', cleanLeft]]) {
    const button = slot.querySelector(`[data-action="${action}"]`);
    if (!button) continue;
    button.disabled = busy || left > 0;
    const label = button.querySelector('small');
    if (label) label.textContent = left > 0 ? formatLeft(left) : 'hazır';
  }
}

export function stopAquariumPolling() {
  clearInterval(pollTimer);
  clearInterval(clockTimer);
  pollTimer = null;
  clockTimer = null;
}

/* Dokununca balik urkekce kacar. */
document.addEventListener(
  'pointerdown',
  (event) => {
    const fish = event.target instanceof Element ? event.target.closest('.aquarium-fish') : null;
    if (!fish) return;
    fish.classList.remove('is-scared');
    void fish.offsetWidth;
    fish.classList.add('is-scared');
    clearTimeout(fish._scareTimer);
    fish._scareTimer = setTimeout(() => fish.classList.remove('is-scared'), 900);
  },
  { passive: true },
);
