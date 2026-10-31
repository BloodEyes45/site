import {
  DAYS,
  COURSE_COLORS,
  NOTE_MOODS,
  GARDEN_STAGES,
} from './data.js';
import {
  loadState,
  saveState,
  saveStateSoon,
  createId,
  getInitials,
  minutesFromTime,
} from './state.js';
import {
  addDays,
  dateKey,
  dayNumber,
  formatClock,
  formatDayMonth,
  formatHour,
  formatLongDate,
  formatWeekday,
  greeting,
  isDaytime,
  lessonStatus,
  nextLesson,
  nowMinutes,
  relativeLessonLabel,
  sortedLessons,
  todaySummary,
  weekDates,
} from './time.js';
import { icon, weatherArt } from './icons.js';
import {
  clamp,
  escapeHtml,
  formatCoords,
  formatRelativeTime,
  hashString,
} from './utils.js';
import {
  currentWeather,
  dailyForecast,
  fetchWeather,
  hourlyForecast,
  reverseGeocode,
  weatherKey,
  weatherMood,
} from './weather.js';
import { createMap } from './tilemap.js';
import {
  clearPresence,
  cloudEnabled,
  fetchSpace,
  prettySyncError,
  writeEvent,
  writePresence,
  writePulse,
} from './sync.js';

const APP_VERSION = '1.1.4';
const WEATHER_TTL = 15 * 60 * 1000;
const TABS = [
  { id: 'today', label: 'Bugün', icon: 'today' },
  { id: 'schedule', label: 'Dersler', icon: 'calendar' },
  { id: 'us', label: 'Biz', icon: 'heart' },
];
const THEME_META = { light: '#f5f1e9', dark: '#0b0b11' };

let state = loadState();
let activeTab = tabFromHash();
let weatherLoading = false;
let weatherError = '';
let miniMap = null;
let sheetMap = null;
let clockTimer = null;
let weatherTimer = null;
let cloudTimer = null;
let heartbeatTimer = null;
let systemThemeQuery = null;
let locationWatchId = null;
let locationPromptTimer = null;
let reverseLookupPending = false;

const ui = {
  scheduleDay: dayNumber(),
  noteMood: 'love',
  sheet: null,
  sheetKind: '',
  cloudState: cloudEnabled() ? 'connecting' : 'local',
  cloudError: '',
  syncing: false,
  seenPulse: Number(state.couple.seenPulse) || 0,
  todaySignature: '',
  lastDateKey: dateKey(new Date()),
  locationState: 'idle',
  locationError: '',
  mapFollow: true,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* -------------------------------------------------------------------------- */
/*  init                                                                      */
/* -------------------------------------------------------------------------- */

applyTheme();
renderAll();
showTab(activeTab, { updateHash: false });
bindGlobalEvents();
startClock();
startCloudRuntime();
setTimeout(() => {
  const boot = $('#boot');
  boot?.classList.add('is-done');
  setTimeout(() => boot?.remove(), 700);
}, 380);

refreshWeather();
setTimeout(() => startLiveLocation(), 650);
weatherTimer = setInterval(() => {
  if (document.visibilityState === 'visible' && navigator.onLine) refreshWeather();
}, 10 * 60 * 1000);
registerServiceWorker();
updateOnlineStatus();

/* -------------------------------------------------------------------------- */
/*  state helpers                                                             */
/* -------------------------------------------------------------------------- */

function tabFromHash() {
  const hash = location.hash.replace('#', '');
  if (hash === 'dersler' || hash === 'schedule') return 'schedule';
  if (hash === 'biz' || hash === 'us') return 'us';
  return 'today';
}

function resolvedTheme() {
  if (state.settings.theme === 'dark') return 'dark';
  if (state.settings.theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.reduceMotion = state.settings.reduceMotion ? 'true' : 'false';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_META[theme]);
  const iosStatus = $('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (iosStatus) {
    iosStatus.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  }
  if (miniMap) miniMap.setTheme(theme);
  if (sheetMap) sheetMap.setTheme(theme);
}

function persist() {
  saveState(state);
}

function persistSoon() {
  saveStateSoon(state);
}

function courseColor(title = '') {
  return COURSE_COLORS[hashString(title) % COURSE_COLORS.length];
}

function courseStyle(title) {
  const color = courseColor(title);
  return `--course-a:${color.from};--course-b:${color.to};--course-rgb:${color.soft};`;
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} saat ${minutes} dk`;
  if (hours) return `${hours} saat`;
  return `${minutes} dk`;
}

function formatTemp(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°` : '—°';
}

function hasLocation() {
  return Number.isFinite(state.location.lat) && Number.isFinite(state.location.lon);
}

function locationLabel() {
  if (ui.locationState === 'denied') return 'Konum izni gerekli';
  if (ui.locationState === 'unsupported') return 'Konum desteklenmiyor';
  if (ui.locationState === 'error') return 'Konum alınamadı';
  if (hasLocation()) return state.location.name || 'Konumun';
  return 'Canlı konum';
}

function locationHint() {
  if (ui.locationState === 'denied') return 'İzin vermek için dokun';
  if (ui.locationState === 'unsupported') return 'Bu cihaz desteklemiyor';
  if (ui.locationState === 'error') return 'Tekrar denemek için dokun';
  if (ui.locationState === 'requesting') return 'Konum alınıyor…';
  return 'Canlı takip';
}

function distanceMeters(aLat, aLon, bLat, bLon) {
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return Infinity;
  const earth = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function weatherData() {
  if (!hasLocation() || !state.weather?.data) return null;
  return state.weather.data;
}

function weatherIsFresh() {
  return Boolean(
    weatherData() && Date.now() - (state.weather.fetchedAt || 0) < WEATHER_TTL,
  );
}

function goldenHour(forecast, now) {
  if (!forecast) return null;
  const moment = now.getTime();
  const sunrise = forecast.sunrise ? new Date(forecast.sunrise).getTime() : NaN;
  const sunset = forecast.sunset ? new Date(forecast.sunset).getTime() : NaN;
  if (Number.isFinite(sunrise) && moment >= sunrise - 20 * 60000 && moment <= sunrise + 60 * 60000) {
    return 'sunrise';
  }
  if (Number.isFinite(sunset) && moment >= sunset - 60 * 60000 && moment <= sunset + 20 * 60000) {
    return 'sunset';
  }
  return null;
}

function skyState(data = weatherData(), now = new Date()) {
  const current = currentWeather(data);
  const daylight = current ? Boolean(current.is_day) : isDaytime(now);
  if (!current) return daylight ? 'clear-day' : 'clear-night';

  const kind = current.kind;
  if (kind === 'storm') return 'storm';
  if (kind === 'snow') return 'snow';
  if (kind === 'rain' || kind === 'drizzle') return 'rain';
  if (kind === 'fog') return 'fog';

  const forecast = data ? dailyForecast(data, 1)[0] : null;
  const golden = goldenHour(forecast, now);
  if (golden && ['clear', 'partly', 'cloudy'].includes(kind)) return golden;

  if (kind === 'cloudy') return 'cloudy';
  return `${kind}-${daylight ? 'day' : 'night'}`;
}

function applySkyState() {
  const sky = skyState();
  document.documentElement.dataset.sky = sky;
  $$('.hero').forEach((element) => {
    element.dataset.sky = sky;
  });
  $$('.terrarium').forEach((element) => {
    element.dataset.sky = sky;
  });
}

function initials(name) {
  return getInitials(name) || 'S';
}

/* -------------------------------------------------------------------------- */
/*  derived couple state                                                      */
/* -------------------------------------------------------------------------- */

function deriveCouple(now = new Date()) {
  const events = [...state.couple.events].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const uid = state.couple.uid;
  const today = dateKey(now);
  const deleted = new Set(
    events.filter((event) => event.type === 'note-delete').map((event) => event.targetId),
  );
  const waterEvents = events.filter((event) => event.type === 'water');
  const notes = events
    .filter(
      (event) =>
        event.type === 'note' &&
        event.text &&
        !deleted.has(event.id) &&
        !deleted.has(event.targetId),
    )
    .slice(-30)
    .reverse();

  const presence = state.couple.presence || {};
  const otherUidFromPresence = Object.keys(presence).find((key) => key !== uid);
  const otherUidFromEvents = [...events]
    .reverse()
    .map((event) => event.uid)
    .find((eventUid) => eventUid && eventUid !== uid);
  const partnerUid = otherUidFromPresence || otherUidFromEvents || null;

  const partnerPresence = partnerUid ? presence[partnerUid] : null;
  const partnerOnline = Boolean(
    partnerPresence?.ts && Date.now() - Number(partnerPresence.ts) < 120000,
  );
  const presenceName = partnerPresence?.name;
  const partnerName =
    presenceName && presenceName !== state.profile.name
      ? presenceName
      : state.profile.partnerName || 'Aşkım';

  const waterToday = waterEvents.filter((event) => event.date === today);
  const myWaterToday = waterToday.filter((event) => event.uid === uid).length;
  const partnerWaterToday = partnerUid
    ? waterToday.filter((event) => event.uid === partnerUid).length
    : 0;

  const totalWater = waterEvents.length;
  let stageIndex = 0;
  GARDEN_STAGES.forEach((stage, index) => {
    if (totalWater >= stage.at) stageIndex = index;
  });
  const stage = GARDEN_STAGES[stageIndex];
  const nextStage = GARDEN_STAGES[stageIndex + 1] || null;
  const stageSpan = nextStage ? nextStage.at - stage.at : 1;
  const stageProgress = nextStage
    ? clamp(((totalWater - stage.at) / stageSpan) * 100, 0, 100)
    : 100;

  const waterDays = [...new Set(waterEvents.map((event) => event.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date(now);
  if (!waterDays.includes(dateKey(cursor))) cursor = addDays(cursor, -1);
  while (waterDays.includes(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const latestNote = notes[0] || null;
  const pulses = state.couple.pulses || {};

  return {
    uid,
    partnerUid,
    partnerName,
    partnerOnline,
    partnerPresence,
    events,
    waterEvents,
    totalWater,
    myWaterToday,
    partnerWaterToday,
    canWater: myWaterToday < 3,
    stageIndex,
    stage,
    nextStage,
    stageProgress,
    notes,
    streak,
    latestNote,
    pulses,
    today,
  };
}

/* -------------------------------------------------------------------------- */
/*  render: shell and tabs                                                    */
/* -------------------------------------------------------------------------- */

function renderAll() {
  renderToday();
  renderSchedule();
  renderUs();
  renderTabbar();
}

function renderTabbar() {
  const tabbar = $('#tabbar');
  if (!tabbar) return;
  tabbar.innerHTML = TABS.map(
    (tab) => `
      <button class="tabbar__item ${tab.id === activeTab ? 'is-active' : ''}"
        data-tab="${tab.id}" aria-label="${tab.label}"
        ${tab.id === activeTab ? 'aria-current="page"' : ''}>
        ${icon(tab.icon)}
        <span>${tab.label}</span>
      </button>`,
  ).join('');
}

function showTab(tabId, { updateHash = true } = {}) {
  if (!TABS.some((tab) => tab.id === tabId)) tabId = 'today';
  const changed = activeTab !== tabId;
  activeTab = tabId;

  $$('.view').forEach((view) => {
    const visible = view.dataset.view === tabId;
    view.hidden = !visible;
    if (visible) {
      view.classList.remove('view');
      void view.offsetWidth;
      view.classList.add('view');
    }
  });

  renderTabbar();

  if (tabId === 'today') {
    requestAnimationFrame(() => {
      if (miniMap) miniMap.invalidate();
      else mountMiniMap();
    });
  }
  if (tabId === 'us' && cloudEnabled()) syncNow();

  if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  if (updateHash) {
    const hash = tabId === 'today' ? 'bugun' : tabId === 'schedule' ? 'dersler' : 'biz';
    history.replaceState(null, '', `#${hash}`);
  }
  state.ui.lastTab = tabId;
  persistSoon();
}

/* -------------------------------------------------------------------------- */
/*  render: today                                                             */
/* -------------------------------------------------------------------------- */

function renderToday() {
  if (miniMap) {
    miniMap.destroy();
    miniMap = null;
  }

  const view = $('#view-today');
  if (!view) return;

  const now = new Date();
  const summary = todaySummary(state.lessons, now);
  const next = nextLesson(state.lessons, now);
  const data = weatherData();
  const current = currentWeather(data);
  const forecast = data ? dailyForecast(data, 1)[0] : null;
  const greetingText = greeting(now);
  const isDay = current ? Boolean(current.is_day) : isDaytime(now);
  const nameLength = state.profile.name.length;
  const nameClass = nameLength > 11 ? 'is-very-long' : nameLength > 8 ? 'is-long' : '';
  const sky = skyState(data, now);
  const located = hasLocation();
  const locationName = located ? state.location.name || 'Konumun' : locationLabel();
  const locationDetail = located ? locationDetailText() : locationHint();

  ui.todaySignature = `${dateKey(now)}|${greetingText}|${summary.kind}|${summary.lesson?.id || ''}|${next?.lesson?.id || ''}`;

  const summaryText = buildHeroSummary(summary, next, now);
  const orb = renderWeatherOrb(current, weatherLoading, located);

  view.innerHTML = `
    <div class="today">
      <header class="home-top">
        <div class="home-top__date">
          <span class="live-dot"></span>
          <span>${escapeHtml(formatLongDate(now))}</span>
        </div>
        <div class="home-top__right">
          <time class="home-clock" data-clock>${formatClock(now)}</time>
          <button class="round-btn" data-action="toggle-theme" aria-label="Temayı değiştir">
            ${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon')}
          </button>
        </div>
      </header>

      <section class="hero glass" data-sky="${sky}" aria-label="Günlük özet">
        <div class="hero-sky" aria-hidden="true">
          <span class="hero-sky__stars"></span>
          <span class="hero-sky__glow"></span>
          <span class="hero-sky__cloud hero-sky__cloud--one"></span>
          <span class="hero-sky__cloud hero-sky__cloud--two"></span>
          <span class="hero-sky__rain"></span>
          <span class="hero-sky__snow"></span>
          <span class="hero-sky__fog"></span>
          <span class="hero-sky__flash"></span>
        </div>
        <div class="hero__top">
          <div class="hero__intro">
            <p class="hero__eyebrow">${icon('sparkles')} günün ritmi</p>
            <h1 class="hero__title">${greetingText},<br /><span class="hero__name ${nameClass}">${escapeHtml(state.profile.name)}</span></h1>
            <p class="hero__summary">${summaryText}</p>
          </div>
          ${orb}
        </div>
        <div class="hero__bottom">
          <button class="location-chip ${located ? '' : 'location-chip--action'}" data-action="${located ? 'open-map' : 'request-location'}" aria-label="${located ? 'Canlı konumu haritada gör' : 'Konum izni ver'}">
            <span class="location-chip__pin">${icon(located ? 'pin' : 'locate')}</span>
            <span class="location-chip__copy">
              <strong data-location-name>${escapeHtml(locationName)}</strong>
              <small data-location-detail>${escapeHtml(locationDetail)}</small>
            </span>
            ${icon(located ? 'chevronRight' : 'arrowRight')}
          </button>
          <div class="hero__mood" style="--hint-color:${isDay ? 'var(--accent-3)' : 'var(--accent-2)'}">
            ${icon(located ? (isDay ? 'sun' : 'moon') : 'locate')}
            <span>${escapeHtml(located ? weatherMood(current) : 'Canlı konumun hazırlanıyor')}</span>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="today-classes-title">
        <div class="section-head">
          <h2 id="today-classes-title">Bugünkü derslerimiz</h2>
          <button class="text-link" data-tab="schedule">Haftaya bak ${icon('chevronRight')}</button>
        </div>
        ${renderTodayClasses(summary, next, now)}
      </section>

      <section class="section" aria-labelledby="location-title">
        <div class="section-head">
          <h2 id="location-title">Canlı konumun</h2>
          ${located ? `<button class="text-link" data-action="open-map">Haritada aç ${icon('chevronRight')}</button>` : ''}
        </div>
        ${
          located
            ? `<button class="map-card" data-action="open-map" aria-label="Canlı konumunu haritada aç">
                <div id="miniMap" class="mini-map"></div>
                <span class="map-card__shade"></span>
                <span class="map-card__top">
                  <span class="map-card__label">
                    <span class="live-dot"></span>
                    <span class="map-card__label-copy">
                      <strong data-location-name>${escapeHtml(locationName)}</strong>
                      <small data-location-detail>${escapeHtml(locationDetail)}</small>
                    </span>
                  </span>
                </span>
                <span class="map-card__bottom">
                  <span class="map-card__coords" data-location-coords>${escapeHtml(formatCoords(state.location.lat, state.location.lon))}</span>
                  <span class="map-card__cta">Canlı ${icon('arrowUpRight')}</span>
                </span>
              </button>`
            : renderLocationGate()
        }
      </section>

      <section class="section" aria-labelledby="us-preview-title">
        ${renderUsPreview()}
      </section>

      ${forecast ? `<p class="schedule-note">${icon('locate')} Hava durumu canlı konumuna göre ${formatRelativeTime(state.weather.fetchedAt)} güncellendi.</p>` : ''}
    </div>
  `;

  applySkyState();
  mountMiniMap();
}

function updateLiveProgress(lesson, now) {
  const bar = $('.class-focus .class-progress span');
  if (!bar) return;
  const start = minutesFromTime(lesson.start);
  const end = minutesFromTime(lesson.end);
  const percent = clamp(((nowMinutes(now) - start) / Math.max(1, end - start)) * 100, 0, 100);
  const remaining = Math.max(0, end - nowMinutes(now));
  bar.style.width = `${percent}%`;
  const labels = $$('.class-focus__progress-label span');
  if (labels[0]) labels[0].textContent = `${Math.round(percent)}% tamamlandı`;
  if (labels[1]) labels[1].textContent = `${remaining} dk kaldı`;
}

function buildHeroSummary(summary, next, now) {
  const count = summary.items.length;
  if (summary.kind === 'live') {
    return `Şu an <strong>${escapeHtml(summary.lesson.title)}</strong> dersindesin. Bitiş: <strong>${summary.lesson.end}</strong>.`;
  }
  if (summary.kind === 'upcoming') {
    const countText = `${count} dersin`;
    return `Bugün <strong>${countText}</strong> var. İlk ders <strong>${summary.lesson.start}</strong>, ${escapeHtml(summary.lesson.title)}.`;
  }
  if (summary.kind === 'done') {
    if (next) {
      return `Bugünkü dersler tamam. Sıradaki ders ${relativeLessonLabel(next.day, next.dateOffset)} <strong>${next.lesson.start}</strong>.`;
    }
    return 'Bugünkü dersler tamam. Gerisi tamamen senin.';
  }
  if (next) {
    return `Bugün ders yok. Sıradaki ders ${relativeLessonLabel(next.day, next.dateOffset)} <strong>${next.lesson.start}</strong>.`;
  }
  return 'Ders programın henüz boş. İlk dersini ekleyerek başlayalım.';
}

function renderWeatherOrb(current, loading, located) {
  if (current) {
    return `
      <button class="weather-orb" data-action="open-weather" aria-label="7 günlük hava durumunu aç">
        <span class="weather-orb__art">${weatherArt(current.kind, current.isDay)}</span>
        <span class="weather-orb__temp">${formatTemp(current.temperature)}</span>
        <span class="weather-orb__label">${escapeHtml(current.name)}</span>
        <span class="weather-orb__cta">7 gün ${icon('chevronRight')}</span>
      </button>`;
  }
  if (!located) {
    const denied = ui.locationState === 'denied' || ui.locationState === 'unsupported';
    if (ui.locationState === 'requesting') {
      return `
        <div class="weather-orb" aria-label="Konum alınıyor">
          <span class="weather-orb__art">${weatherArt('partly', true)}</span>
          <span class="weather-orb__temp">—°</span>
          <span class="weather-orb__label">Canlı konum alınıyor</span>
          <span class="weather-orb__cta">izin bekleniyor</span>
        </div>`;
    }
    return `
      <button class="weather-orb" data-action="request-location" aria-label="Konum izni ver">
        <span class="weather-orb__art">${weatherArt('partly', true)}</span>
        <span class="weather-orb__temp">—°</span>
        <span class="weather-orb__label">${denied ? 'Konum izni gerekli' : 'Konumunu bulalım'}</span>
        <span class="weather-orb__cta">izin ver ${icon('arrowRight')}</span>
      </button>`;
  }
  if (loading) {
    return `
      <div class="weather-orb" aria-label="Hava durumu yükleniyor">
        <span class="weather-orb__art">${weatherArt('cloudy', true)}</span>
        <span class="weather-orb__temp">—°</span>
        <span class="weather-orb__label">Gökyüzü hazırlanıyor</span>
        <span class="weather-orb__cta">yükleniyor</span>
      </div>`;
  }
  return `
    <button class="weather-orb" data-action="open-weather" aria-label="Hava durumu">
      <span class="weather-orb__art">${weatherArt('cloudy', true)}</span>
      <span class="weather-orb__temp">—°</span>
      <span class="weather-orb__label">Hava durumu alınamadı</span>
      <span class="weather-orb__cta">dene ${icon('chevronRight')}</span>
    </button>`;
}

function renderLocationGate() {
  if (['denied', 'unsupported', 'error'].includes(ui.locationState)) {
    return `
      <div class="location-gate">
        <span class="location-gate__icon">${icon('locate')}</span>
        <div>
          <h3>Canlı konum kapalı</h3>
          <p>${escapeHtml(ui.locationError || 'Hava durumu ve harita için konum izni gerekiyor.')}</p>
        </div>
        <button class="secondary" data-action="request-location">${icon('locate')} Konumu aç</button>
      </div>`;
  }
  if (ui.locationState === 'idle') {
    return `
      <div class="location-gate">
        <span class="location-gate__icon">${icon('locate')}</span>
        <div>
          <h3>Canlı konum</h3>
          <p>Bulunduğun yeri bulalım; hava durumu ve harita canlı olarak burada görünecek.</p>
        </div>
        <button class="secondary" data-action="request-location">${icon('locate')} Konumumu kullan</button>
      </div>`;
  }
  return `
    <div class="location-gate is-loading">
      <span class="location-gate__icon">${icon('locate')}</span>
      <div>
        <h3>Konumun alınıyor</h3>
        <p>Bulunduğun yer bulununca hava durumu ve harita burada görünecek.</p>
      </div>
    </div>`;
}

function renderTodayClasses(summary, next, now) {
  const { items, lesson } = summary;
  if (!items.length) {
    return `
      <div class="empty-day">
        <div class="empty-day__art">${icon('sun')}<span>Serbest gün</span></div>
        <h3>Bugün ders yok</h3>
        <p>${next ? 'Sıradaki derse kadar gün senin. İstersen programına yeni bir ders ekleyebilirsin.' : 'Haftalık programın boş görünüyor. İlk dersini ekleyerek başlayabilirsin.'}</p>
        ${
          next
            ? `<div class="next-peek">
                <div class="next-peek__date">
                  <strong>${next.lesson.start.slice(0, 2)}</strong>
                  <small>${next.day.short}</small>
                </div>
                <div class="next-peek__copy">
                  <strong>${escapeHtml(next.lesson.title)}</strong>
                  <small>${relativeLessonLabel(next.day, next.dateOffset)} · ${next.lesson.start}–${next.lesson.end}${next.lesson.place ? ` · ${escapeHtml(next.lesson.place)}` : ''}</small>
                </div>
              </div>`
            : `<button class="secondary" style="margin-top:14px" data-action="add-lesson" data-day="${dayNumber(now)}">${icon('plus')} Ders ekle</button>`
        }
      </div>`;
  }

  const focus = summary.kind === 'live' || summary.kind === 'upcoming' ? lesson : null;
  const focusHtml = focus ? renderFocusClass(focus, summary.kind === 'live', now) : '';
  const rows = items.filter((item) => item.id !== focus?.id);
  const rowsHtml = rows
    .map((item) => {
      const status = lessonStatus(item, now);
      return renderClassRow(item, status);
    })
    .join('');

  const doneBanner =
    summary.kind === 'done'
      ? `<div class="done-banner">${icon('check')} Bugünkü dersler tamamlandı${next ? ` · sıradaki ${relativeLessonLabel(next.day, next.dateOffset)}` : ''}</div>`
      : '';

  return `${focusHtml}${rows.length ? `<div class="class-list">${rowsHtml}</div>` : ''}${doneBanner}`;
}

function renderFocusClass(lesson, isLive, now) {
  const status = lessonStatus(lesson, now);
  const start = minutesFromTime(lesson.start);
  const end = minutesFromTime(lesson.end);
  const percent = isLive
    ? clamp(((nowMinutes(now) - start) / Math.max(1, end - start)) * 100, 0, 100)
    : 0;
  const remaining = Math.max(0, end - nowMinutes(now));
  const place = lesson.place || 'Derslik ekle';
  const badge = isLive ? 'Şimdi' : 'Sırada';
  return `
    <button class="class-focus" style="${courseStyle(lesson.title)}" data-action="edit-lesson" data-id="${escapeHtml(lesson.id)}" aria-label="${escapeHtml(lesson.title)} dersini düzenle">
      <div class="class-focus__top">
        <span class="status-badge ${isLive ? 'status-badge--live' : ''}">${badge}</span>
        <span class="class-focus__time">${lesson.start} – ${lesson.end}</span>
      </div>
      <h3>${escapeHtml(lesson.title)}</h3>
      <div class="class-focus__meta">
        <span class="${lesson.place ? '' : 'is-missing'}">${icon('pin')} ${escapeHtml(place)}</span>
        <span>${icon('clock')} ${formatDuration(end - start)}</span>
      </div>
      ${
        isLive
          ? `<div class="class-progress"><span style="width:${percent}%"></span></div>
             <div class="class-focus__progress-label"><span>${Math.round(percent)}% tamamlandı</span><span>${remaining} dk kaldı</span></div>`
          : ''
      }
    </button>`;
}

function renderClassRow(lesson, status) {
  const statusLabel = status === 'live' ? 'Şimdi' : status === 'done' ? 'Bitti' : '';
  const place = lesson.place || 'Derslik ekle';
  return `
    <button class="class-row ${status === 'live' ? 'is-live' : ''} ${status === 'done' ? 'is-done' : ''}" style="${courseStyle(lesson.title)}" data-action="edit-lesson" data-id="${escapeHtml(lesson.id)}">
      <span class="class-row__time">${lesson.start}<small>${lesson.end}</small></span>
      <span class="class-row__body">
        <strong>${escapeHtml(lesson.title)}</strong>
        <small>${icon('pin')} <span class="${lesson.place ? '' : 'is-missing'}">${escapeHtml(place)}</span></small>
      </span>
      ${statusLabel ? `<span class="class-row__status">${statusLabel}</span>` : icon('chevronRight', 'icon--sm')}
    </button>`;
}

function renderUsPreview() {
  const couple = deriveCouple();
  const note = couple.latestNote;
  const copy = note
    ? `${note.uid === state.couple.uid ? 'Sen' : couple.partnerName}: ${note.text}`
    : couple.totalWater
      ? 'Bahçeniz büyüyor. Birlikte bir not bırakın.'
      : 'İlk damlayı birlikte bırakın, bahçeniz filizlensin.';
  return `
    <button class="us-preview" data-tab="us" aria-labelledby="us-preview-title">
      <span class="us-preview__art">${icon('heartFilled')}</span>
      <span class="us-preview__copy">
        <span class="eyebrow" id="us-preview-title">Bizim bahçemiz</span>
        <span class="us-preview__title">${escapeHtml(couple.stage.label)}</span>
        <span class="us-preview__desc">${escapeHtml(copy)}</span>
      </span>
      <span class="us-preview__arrow">${icon('arrowUpRight')}</span>
    </button>`;
}

function mountMiniMap() {
  const element = $('#miniMap');
  if (!element || !hasLocation()) return;
  requestAnimationFrame(() => {
    if (!$('#miniMap') || activeTab !== 'today') return;
    miniMap = createMap(element, {
      lat: state.location.lat,
      lon: state.location.lon,
      zoom: 14,
      interactive: false,
      showPin: true,
      theme: resolvedTheme(),
    });
  });
}

/* -------------------------------------------------------------------------- */
/*  render: schedule                                                          */
/* -------------------------------------------------------------------------- */

function renderSchedule() {
  const view = $('#view-schedule');
  if (!view) return;

  const today = dayNumber();
  if (!ui.scheduleDay) ui.scheduleDay = today;
  const selected = Number(ui.scheduleDay) || today;
  const week = weekDates(new Date());
  const selectedWeekDay = week.find((day) => day.id === selected) || week[0];
  const lessons = sortedLessons(state.lessons, selected);
  const totalMinutes = lessons.reduce(
    (total, lesson) => total + Math.max(0, minutesFromTime(lesson.end) - minutesFromTime(lesson.start)),
    0,
  );
  const weekLessonCount = state.lessons.length;
  const day = DAYS[selected - 1];

  view.innerHTML = `
    <div class="schedule-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Haftalık program</p>
          <h1>Dersler</h1>
          <p class="page-head__sub">${weekLessonCount} ders · ${lessons.length ? `${lessons.length} tanesi ${day.name.toLocaleLowerCase('tr-TR')}` : `${day.name} boş`}</p>
        </div>
        <div class="page-head__actions">
          <button class="round-btn" data-action="toggle-theme" aria-label="Temayı değiştir">${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon')}</button>
          <button class="round-btn round-btn--accent" data-action="add-lesson" aria-label="Yeni ders ekle">${icon('plus')}</button>
        </div>
      </header>

      <div class="week-strip" role="tablist" aria-label="Haftanın günleri">
        ${week
          .map((dayItem) => {
            const count = sortedLessons(state.lessons, dayItem.id).length;
            return `
              <button class="day-chip ${dayItem.id === selected ? 'is-selected' : ''} ${dayItem.id === today ? 'is-today' : ''} ${count ? 'has-lesson' : ''}"
                role="tab" aria-selected="${dayItem.id === selected}" aria-label="${dayItem.name}, ${formatDayMonth(dayItem.date)}, ${count} ders"
                data-action="select-day" data-day="${dayItem.id}">
                <span class="day-chip__name">${dayItem.short}</span>
                <span class="day-chip__date">${dayItem.date.getDate()}</span>
                <span class="day-chip__dot"></span>
              </button>`;
          })
          .join('')}
      </div>

      <div class="day-head">
        <div>
          <h2>${day.name}</h2>
          <p>${formatDayMonth(selectedWeekDay.date)}${selected === today ? ' · bugün' : ''}</p>
        </div>
        ${lessons.length ? `<span class="day-head__total">${icon('clock')} ${formatDuration(totalMinutes)}</span>` : ''}
      </div>

      ${
        lessons.length
          ? `<div class="lesson-stack">
              ${lessons.map((lesson) => renderLessonCard(lesson, selected, today)).join('')}
             </div>`
          : `<div class="empty-state">
              <div class="empty-state__icon">${icon('calendar')}</div>
              <h3>Bu gün boş</h3>
              <p>${day.name} için henüz ders eklenmemiş. Saatini ve yerini ekleyerek programını tamamla.</p>
              <button class="primary" data-action="add-lesson">${icon('plus')} Ders ekle</button>
            </div>`
      }

      <button class="add-lesson-inline" data-action="add-lesson">${icon('plus')} Yeni ders ekle</button>
      <p class="schedule-note">${icon('info')} Ders kartına dokunarak adı, saatini veya derslik bilgisini düzenleyebilirsin.</p>
    </div>
  `;
}

function renderLessonCard(lesson, selectedDay, today) {
  const status = lessonStatus(lesson, new Date(), selectedDay);
  const place = lesson.place || 'Derslik ekle';
  return `
    <button class="lesson-card" style="${courseStyle(lesson.title)}" data-action="edit-lesson" data-id="${escapeHtml(lesson.id)}" aria-label="${escapeHtml(lesson.title)} dersini düzenle">
      <span class="lesson-card__time">
        <strong>${lesson.start}</strong>
        <span>${lesson.end}</span>
      </span>
      <span class="lesson-card__body">
        <h3>${escapeHtml(lesson.title)}</h3>
        <p class="${lesson.place ? '' : 'is-missing'}">${icon('pin')} ${escapeHtml(place)}</p>
      </span>
      <span class="lesson-card__chevron">${icon('chevronRight')}</span>
      ${status === 'live' ? '<span class="lesson-card__now">şimdi</span>' : ''}
    </button>`;
}

/* -------------------------------------------------------------------------- */
/*  render: us                                                                */
/* -------------------------------------------------------------------------- */

function renderUs() {
  const view = $('#view-us');
  if (!view) return;

  const couple = deriveCouple();
  const cloud = cloudEnabled();
  const needsPermission = /izin|izni|permission/i.test(ui.cloudError || '');
  const syncLabel = !cloud
    ? 'Yerel'
    : ui.cloudState === 'connected'
      ? couple.partnerOnline
        ? `${couple.partnerName} burada`
        : 'Bağlı'
      : ui.cloudState === 'connecting'
        ? 'Bağlanıyor'
        : needsPermission
          ? 'İzin gerekli'
          : 'Bağlantı yok';

  view.innerHTML = `
    <div class="us-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Ortak alan</p>
          <h1>Biz</h1>
          <p class="page-head__sub">${escapeHtml(state.profile.name)} &amp; ${escapeHtml(couple.partnerName)}</p>
        </div>
        <div class="page-head__actions">
          <button class="round-btn" data-action="toggle-theme" aria-label="Temayı değiştir">${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon')}</button>
          <span class="sync-pill ${cloud && ui.cloudState === 'connected' ? 'is-live' : ''} ${cloud && ['error', 'offline'].includes(ui.cloudState) ? 'is-error' : ''}">
            <span class="sync-pill__dot"></span>
            ${escapeHtml(syncLabel)}
          </span>
        </div>
      </header>

      ${
        cloud && ui.cloudState !== 'connected'
          ? `<p class="cloud-note">${icon('cloud')} ${
              needsPermission
                ? 'Firebase Realtime Database izni gerekiyor; o açılana kadar notlar ve bahçe bu cihazda saklanıyor.'
                : 'Bulut bağlantısı kurulamadı; notlar ve bahçe şimdilik bu cihazda saklanıyor.'
            }</p>`
          : ''
      }

      ${renderGarden(couple, cloud)}

      <section class="notes-section" aria-labelledby="notes-title">
        <div class="section-head">
          <h2 id="notes-title">Küçük notlar</h2>
          <button class="text-link" data-action="add-note">${icon('plus')} Not bırak</button>
        </div>
        ${renderNotes(couple)}
      </section>
    </div>
  `;

  applySkyState();
}

function renderGarden(couple, cloud) {
  const sky = skyState();
  const stage = couple.stage;
  const next = couple.nextStage;
  const ownCount = couple.myWaterToday;
  const partnerCount = couple.partnerWaterToday;
  const canWater = couple.canWater;
  const presenceText = cloud
    ? couple.partnerOnline
      ? `${couple.partnerName} şu an burada`
      : couple.partnerPresence?.ts
        ? `${couple.partnerName} · ${formatRelativeTime(couple.partnerPresence.ts)} görüldü`
        : `${couple.partnerName} henüz bağlanmadı`
    : 'Sadece bu cihazda';

  return `
    <section class="garden-card" aria-labelledby="garden-title">
      <div class="terrarium" data-stage="${couple.stageIndex}" data-sky="${sky}" id="terrarium">
        <span class="terrarium__tint"></span>
        <span class="terrarium__stars"></span>
        <span class="terrarium__sun"></span>
        <span class="terrarium__moon"></span>
        <span class="terrarium__cloud"></span>
        <span class="terrarium__rain"></span>
        <span class="terrarium__snow"></span>
        <span class="terrarium__fog"></span>
        <span class="terrarium__flash"></span>
        <span class="terrarium__dome"></span>
        <span class="terrarium__soil"></span>
        ${plantSvg()}
        <span class="terrarium__ground"></span>
        <span class="terrarium__drop terrarium__drop--1"></span>
        <span class="terrarium__drop terrarium__drop--2"></span>
        <span class="terrarium__drop terrarium__drop--3"></span>
        <span class="terrarium__drop terrarium__drop--4"></span>
      </div>
      <div class="garden-content">
        <div class="garden-title">
          <div>
            <p class="eyebrow">Bizim bahçemiz</p>
            <h2 id="garden-title">${escapeHtml(stage.label)}</h2>
          </div>
          <span class="garden-title__drops">${icon('droplet')} ${couple.totalWater} damla</span>
        </div>
        <p class="garden-caption">${escapeHtml(stage.caption)}</p>

        <div class="garden-meter">
          <div class="garden-meter__bar"><span style="width:${couple.stageProgress}%"></span></div>
          <div class="garden-meter__labels">
            <span>${next ? `Sıradaki: ${escapeHtml(next.label)}` : 'Bahçe dolup taşıyor'}</span>
            <span>${next ? `${Math.max(0, next.at - couple.totalWater)} damla kaldı` : `${couple.totalWater} damla`}</span>
          </div>
        </div>

        <div class="garden-actions">
          <button class="primary" data-action="water" ${canWater ? '' : 'disabled'}>
            ${icon('droplet')} ${canWater ? 'Sula' : 'Yarın yine'}
          </button>
          <button class="secondary" data-action="send-heart">${icon('heart')} Kalp gönder</button>
        </div>

        <div class="water-counts">
          <span>${icon('droplet')} Sen ${ownCount}/3${cloud ? ` · ${escapeHtml(couple.partnerName)} ${partnerCount}/3` : ''}</span>
          <span class="presence-line">
            <span class="presence-line__dot ${couple.partnerOnline ? 'is-online' : ''}"></span>
            ${escapeHtml(presenceText)}
          </span>
        </div>
      </div>
    </section>`;
}

function plantSvg() {
  return `
    <svg class="plant" viewBox="70 45 110 125" aria-hidden="true">
      <defs>
        <linearGradient id="leafGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9bd9a9" />
          <stop offset="0.55" stop-color="#65b985" />
          <stop offset="1" stop-color="#3e8b66" />
        </linearGradient>
        <linearGradient id="flowerGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd1dc" />
          <stop offset="0.55" stop-color="#ff9fb4" />
          <stop offset="1" stop-color="#f27796" />
        </linearGradient>
      </defs>
      <path class="plant__stem plant__stem--soft" d="M122 160 C112 145 120 132 106 121" />
      <path class="plant__stem plant__stem--soft" d="M122 158 C137 146 132 132 143 120" />
      <path class="plant__stem" d="M120 162 C116 132 120 107 120 78" />
      <g class="plant__leaf plant__leaf--1">
        <path d="M120 126 C98 125 82 114 78 94 C100 94 116 106 120 126Z" />
        <path d="M83 98 C96 105 108 114 118 124" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.2" />
      </g>
      <g class="plant__leaf plant__leaf--2">
        <path d="M121 109 C142 108 158 97 162 78 C140 78 124 90 121 109Z" />
      </g>
      <g class="plant__leaf plant__leaf--3 plant__leaf--small">
        <path d="M121 91 C104 89 92 80 89 65 C106 65 119 75 121 91Z" />
      </g>
      <g class="plant__leaf plant__leaf--4 plant__leaf--small">
        <path d="M121 84 C136 81 146 71 149 58 C132 58 121 69 121 84Z" />
      </g>
      <g class="plant__flower">
        <circle class="plant__petal" cx="120" cy="57" r="12" />
        <circle class="plant__petal" cx="132" cy="65" r="11" />
        <circle class="plant__petal" cx="129" cy="79" r="11" />
        <circle class="plant__petal" cx="111" cy="79" r="11" />
        <circle class="plant__petal" cx="108" cy="65" r="11" />
        <circle class="plant__center" cx="120" cy="70" r="6" />
      </g>
      <path class="plant__heart" d="M78 60c-4-4-10-1-10 4 0 5 6 9 10 12 4-3 10-7 10-12 0-5-6-8-10-4Z" />
      <path class="plant__heart" d="M166 50c-3-3-8-1-8 3 0 4 5 7 8 9 3-2 8-5 8-9 0-4-5-6-8-3Z" />
      <path class="plant__heart" d="M171 92c-3-3-8-1-8 3 0 4 5 7 8 9 3-2 8-5 8-9 0-4-5-6-8-3Z" />
    </svg>`;
}

function renderNotes(couple) {
  if (!couple.notes.length) {
    return `
      <div class="notes-empty">
        ${icon('heart')}
        <p>Henüz küçük bir not yok. Aklına gelen ilk şeyi bırak; eşin bir sonraki açılışında görsün.</p>
      </div>`;
  }

  return `
    <div class="notes-list">
      ${couple.notes
        .map((note) => {
          const mine = note.uid === state.couple.uid;
          const mood = NOTE_MOODS.find((item) => item.id === note.mood);
          return `
            <article class="note-card ${mine ? 'note-card--mine' : 'note-card--partner'}">
              <span class="note-card__avatar">${escapeHtml(initials(mine ? state.profile.name : couple.partnerName))}</span>
              <div class="note-card__body">
                <div class="note-card__meta">
                  <strong>${escapeHtml(mine ? 'Sen' : couple.partnerName)}</strong>
                  <span>·</span>
                  <span>${formatRelativeTime(note.ts)}</span>
                  ${mood ? `<span class="note-card__mood">${mood.emoji}</span>` : ''}
                </div>
                <p class="note-card__text">${escapeHtml(note.text)}</p>
              </div>
              ${mine ? `<button class="note-card__delete" data-action="delete-note" data-id="${escapeHtml(note.id)}" aria-label="Notu sil">${icon('trash')}</button>` : ''}
            </article>`;
        })
        .join('')}
    </div>`;
}

/* -------------------------------------------------------------------------- */
/*  clock / online / theme                                                    */
/* -------------------------------------------------------------------------- */

function startClock() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const now = new Date();
    $$('[data-clock]').forEach((element) => {
      element.textContent = formatClock(now);
    });
    applySkyState();
    if (dateKey(now) !== ui.lastDateKey) {
      ui.lastDateKey = dateKey(now);
      ui.scheduleDay = dayNumber(now);
      state.ui.scheduleDay = ui.scheduleDay;
      renderAll();
      refreshWeather({ force: true });
      return;
    }
    const summary = todaySummary(state.lessons, now);
    const next = nextLesson(state.lessons, now);
    const signature = `${dateKey(now)}|${greeting(now)}|${summary.kind}|${summary.lesson?.id || ''}|${next?.lesson?.id || ''}`;
    if (signature !== ui.todaySignature) renderToday();
    else if (activeTab === 'today' && summary.kind === 'live') updateLiveProgress(summary.lesson, now);
  }, 20000);

  if (window.matchMedia) {
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeQuery.addEventListener?.('change', () => {
      if (state.settings.theme === 'system') {
        applyTheme();
        renderAll();
      }
    });
  }
}

function updateOnlineStatus() {
  const pill = $('#offlinePill');
  if (!pill) return;
  pill.hidden = navigator.onLine;
  if (navigator.onLine) {
    if (cloudEnabled()) syncNow();
    if (hasLocation() && !weatherIsFresh()) refreshWeather();
  }
}

/* -------------------------------------------------------------------------- */
/*  live location                                                             */
/* -------------------------------------------------------------------------- */

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 5000,
};

function startLiveLocation({ force = false } = {}) {
  if (!navigator.geolocation) {
    ui.locationState = 'unsupported';
    ui.locationError = 'Bu tarayıcı konum servisini desteklemiyor.';
    renderToday();
    return;
  }
  if (locationWatchId !== null && !force) return;
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }

  ui.locationState = 'requesting';
  ui.locationError = '';
  if (!hasLocation()) renderToday();
  else updateLocationTexts();

  clearTimeout(locationPromptTimer);
  locationPromptTimer = setTimeout(() => {
    if (!hasLocation() && ui.locationState === 'requesting') {
      ui.locationState = 'idle';
      renderToday();
    }
  }, 12000);

  try {
    locationWatchId = navigator.geolocation.watchPosition(
      handleLivePosition,
      handleLocationError,
      LOCATION_OPTIONS,
    );
  } catch {
    ui.locationState = 'error';
    ui.locationError = 'Konum takibi başlatılamadı.';
    renderToday();
  }
}

function handleLivePosition(position) {
  clearTimeout(locationPromptTimer);
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const previous = hasLocation() ? { lat: state.location.lat, lon: state.location.lon } : null;
  const first = !previous;
  const moved = previous ? distanceMeters(previous.lat, previous.lon, lat, lon) : Infinity;
  const now = Date.now();

  state.location = {
    ...state.location,
    lat,
    lon,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    updatedAt: now,
    source: 'live',
  };
  if (!state.location.name || state.location.name === 'Konumun') {
    state.location.name = 'Konumun';
    state.location.detail = 'Canlı konum';
  }
  if (!state.location.detail) state.location.detail = 'Canlı konum';

  const wasDenied = ui.locationState === 'denied' || ui.locationState === 'error';
  ui.locationState = 'live';
  ui.locationError = '';
  persistSoon();

  if (first || wasDenied || !$('#miniMap')) {
    renderToday();
    refreshWeather({ force: true });
    reverseLocationName();
    return;
  }

  updateLocationTexts();
  if (miniMap) {
    miniMap.setView(lat, lon, 14, false);
    miniMap.setMarker(lat, lon);
  }
  updateMapLivePanel();
  if (sheetMap && ui.mapFollow) sheetMap.setView(lat, lon, sheetMap.getCenter().zoom, false);
  if (sheetMap) sheetMap.setMarker(lat, lon);

  if (moved > 1200) reverseLocationName();
  if (moved > 1800) refreshWeather({ force: true });
  else if (!weatherIsFresh()) refreshWeather();
}

function handleLocationError(error) {
  clearTimeout(locationPromptTimer);
  const denied = error?.code === 1;
  ui.locationState = denied ? 'denied' : 'error';
  ui.locationError = denied
    ? 'Konum izni kapalı. Tarayıcı ayarlarından bu siteye izin ver.'
    : error?.code === 3
      ? 'Konum isteği zaman aşımına uğradı. Tekrar deneyelim.'
      : 'Konum şu an alınamıyor. Biraz sonra tekrar dene.';
  if (denied && locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  if (!hasLocation()) renderToday();
  else updateLocationTexts();
  updateMapLivePanel();
}

async function reverseLocationName() {
  if (!hasLocation() || reverseLookupPending) return;
  reverseLookupPending = true;
  const point = { lat: state.location.lat, lon: state.location.lon };
  try {
    const place = await reverseGeocode(point.lat, point.lon);
    if (distanceMeters(point.lat, point.lon, state.location.lat, state.location.lon) > 800) {
      return;
    }
    state.location.name = place.name || 'Konumun';
    state.location.detail = place.detail || 'Canlı konum';
    persistSoon();
    updateLocationTexts();
    if (ui.sheetKind === 'weather') updateWeatherSheet();
  } finally {
    reverseLookupPending = false;
  }
}

function locationDetailText() {
  if (!hasLocation()) return locationHint();
  return state.location.detail || 'Canlı konum';
}

function updateLocationTexts() {
  const name = locationLabel();
  const detail = locationDetailText();
  $$('[data-location-name]').forEach((element) => {
    element.textContent = name;
  });
  $$('[data-location-detail]').forEach((element) => {
    element.textContent = detail;
  });
  $$('[data-location-coords]').forEach((element) => {
    element.textContent = hasLocation()
      ? formatCoords(state.location.lat, state.location.lon)
      : 'Konum bekleniyor';
  });
  updateMapLivePanel();
}

function requestLocation() {
  if (ui.locationState === 'denied') {
    showToast('Tarayıcı adres çubuğundaki konum iznini açmalısın.', { type: 'error' });
  }
  startLiveLocation({ force: true });
}

/* -------------------------------------------------------------------------- */
/*  weather                                                                   */
/* -------------------------------------------------------------------------- */

async function refreshWeather({ force = false, render = true } = {}) {
  if (!hasLocation()) {
    weatherError = 'Canlı konum bekleniyor.';
    if (render) renderToday();
    return;
  }
  if (weatherLoading) return;
  if (
    !force &&
    weatherIsFresh() &&
    state.weather.lat != null &&
    distanceMeters(state.weather.lat, state.weather.lon, state.location.lat, state.location.lon) < 2000
  ) {
    return;
  }
  if (!navigator.onLine && weatherData()) {
    weatherError = 'Çevrimdışısın; son kaydedilen hava durumu gösteriliyor.';
    if (render) renderToday();
    updateWeatherSheet();
    return;
  }

  weatherLoading = true;
  weatherError = '';
  if (render && !weatherData()) renderToday();
  updateWeatherSheet();

  try {
    const data = await fetchWeather(state.location.lat, state.location.lon);
    state.weather = {
      key: weatherKey(state.location.lat, state.location.lon),
      lat: state.location.lat,
      lon: state.location.lon,
      fetchedAt: data.fetchedAt,
      data,
    };
    persist();
    if (render) renderToday();
    applySkyState();
  } catch (error) {
    weatherError = error?.message || 'Hava durumu alınamadı.';
    if (render && !weatherData()) renderToday();
  } finally {
    weatherLoading = false;
    updateWeatherSheet();
  }
}

function updateWeatherSheet() {
  if (ui.sheetKind !== 'weather' || !ui.sheet) return;
  const body = ui.sheet.body;
  const scroll = body.scrollTop;
  body.innerHTML = weatherSheetContent();
  body.scrollTop = scroll;
}

function openWeatherSheet() {
  if (!hasLocation()) {
    requestLocation();
    showToast('Hava durumu için canlı konumunu bulalım.');
    return;
  }
  const sheet = openSheet({
    title: 'Hava durumu',
    subtitle: `${locationLabel()} · 7 günlük görünüm`,
    kind: 'weather',
    content: weatherSheetContent(),
  });
  if (!sheet) return;
  updateWeatherSheet();
  if (!weatherIsFresh()) refreshWeather({ force: true });
}

function weatherSheetContent() {
  const data = weatherData();
  const current = currentWeather(data);

  if (!current) {
    if (weatherLoading) {
      return `
        <div class="weather-loading">
          <div class="skeleton weather-loading__big"></div>
          <div class="weather-loading__row">
            <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
          </div>
          <div class="skeleton" style="height:180px"></div>
        </div>`;
    }
    return `
      <div class="weather-error">
        <span class="weather-error__icon">${icon('offline')}</span>
        <p>${escapeHtml(weatherError || 'Hava durumu şu an alınamıyor. İnternet bağlantını kontrol edip tekrar dene.')}</p>
        <button class="secondary" data-action="refresh-weather">${icon('refresh')} Tekrar dene</button>
      </div>`;
  }

  const days = dailyForecast(data, 7);
  const hours = hourlyForecast(data, 12);
  const today = days[0];
  const lows = days.map((day) => day.low);
  const highs = days.map((day) => day.high);
  const weekMin = Math.min(...lows);
  const weekMax = Math.max(...highs);
  const range = Math.max(1, weekMax - weekMin);

  return `
    <div class="weather-hero">
      <div>
        <button class="weather-hero__place" data-action="open-map">${icon('locate')} ${escapeHtml(locationLabel())} · haritada gör</button>
        <h2>${current.temperature}<sup>°</sup></h2>
        <p class="weather-hero__desc">${escapeHtml(current.name)} · Hissedilen ${current.apparent}°</p>
      </div>
      ${weatherArt(current.kind, current.isDay)}
    </div>

    <div class="weather-stats">
      <div class="weather-stat"><span>${icon('droplet')} Nem</span><strong>%${current.humidity}</strong></div>
      <div class="weather-stat"><span>${icon('wind')} Rüzgâr</span><strong>${current.wind} km/s</strong></div>
      <div class="weather-stat"><span>${icon('cloud')} Yağış</span><strong>%${today?.rain ?? 0}</strong></div>
      <div class="weather-stat"><span>${icon('sun')} Gün doğumu</span><strong>${sunTime(today?.sunrise)}</strong></div>
    </div>

    <div class="weather-section-title">
      <h3>Saat saat</h3>
      <span>önümüzdeki 12 saat</span>
    </div>
    <div class="hour-strip">
      ${hours
        .map(
          (hour, index) => `
            <div class="hour-item ${index === 0 ? 'is-now' : ''}">
              <time>${index === 0 ? 'Şimdi' : formatHour(hour.date)}</time>
              ${weatherArt(hour.kind, hour.isDay)}
              <strong>${hour.temperature}°</strong>
              <small>%${hour.rain}</small>
            </div>`,
        )
        .join('')}
    </div>

    <div class="weather-section-title">
      <h3>7 günlük görünüm</h3>
      <span>${escapeHtml(state.location.name)}</span>
    </div>
    <div class="week-list">
      ${days
        .map((day, index) => {
          const left = ((day.low - weekMin) / range) * 100;
          const width = ((day.high - day.low) / range) * 100;
          const label = index === 0 ? 'Bugün' : index === 1 ? 'Yarın' : formatWeekday(day.date);
          return `
            <div class="week-row">
              <span class="week-row__day"><strong>${label}</strong></span>
              ${weatherArt(day.kind, true)}
              <span class="week-row__rain">%${day.rain}</span>
              <span class="week-row__bar"><span style="left:${left}%;width:${Math.max(6, width)}%"></span></span>
              <span class="week-row__temp">${day.high}°<span>${day.low}°</span></span>
            </div>`;
        })
        .join('')}
    </div>

    <div class="weather-footer">
      <span>${weatherError ? escapeHtml(weatherError) : `${formatRelativeTime(state.weather.fetchedAt)} güncellendi`}</span>
      <button data-action="refresh-weather">${icon('refresh')} Yenile</button>
    </div>
  `;
}

function sunTime(value) {
  if (!value) return '—';
  const time = value.split('T')[1]?.slice(0, 5);
  return time || '—';
}

/* -------------------------------------------------------------------------- */
/*  map                                                                       */
/* -------------------------------------------------------------------------- */

function openMapSheet() {
  if (!hasLocation()) {
    requestLocation();
    showToast('Harita için canlı konumunu bulalım.');
    return;
  }
  ui.mapFollow = true;
  const place = {
    name: locationLabel(),
    detail: locationDetailText(),
    lat: state.location.lat,
    lon: state.location.lon,
    zoom: 15,
  };

  openSheet({
    title: 'Canlı konum',
    kind: 'map',
    variant: 'full',
    content: `
      <div class="map-sheet">
        <div class="map-sheet__canvas" id="fullMap"></div>
        <span class="map-sheet__scrim"></span>

        <div class="map-top">
          <button class="map-top__close" data-sheet-close aria-label="Haritayı kapat">${icon('x')}</button>
          <div class="map-top__place">
            <strong id="mapPlaceName">${escapeHtml(place.name)}</strong>
            <small id="mapPlaceDetail">${escapeHtml(place.detail)}</small>
          </div>
        </div>

        <div class="map-controls">
          <button class="map-control" data-action="map-zoom-in" aria-label="Yakınlaştır">${icon('plus')}</button>
          <button class="map-control" data-action="map-zoom-out" aria-label="Uzaklaştır">${icon('minus')}</button>
          <button class="map-control map-control--locate" data-action="map-recenter" aria-label="Konumuma dön">${icon('locate')}</button>
        </div>

        <div class="map-bottom map-bottom--live">
          <div class="map-live">
            <span class="map-live__badge"><span class="live-dot"></span> Canlı konum</span>
            <span class="map-live__updated" id="mapLiveUpdated">şimdi</span>
          </div>
          <p class="map-bottom__hint">${icon('locate')} Konumun otomatik olarak güncelleniyor.</p>
          <div class="map-bottom__row">
            <div class="map-bottom__coords">
              <strong id="mapLiveName">${escapeHtml(place.name)}</strong>
              <span id="mapLiveCoords">${escapeHtml(formatCoords(place.lat, place.lon))}</span>
              <span id="mapLiveAccuracy">${escapeHtml(accuracyText())}</span>
            </div>
            <button class="secondary map-recenter" data-action="map-recenter">${icon('locate')} Konumuma dön</button>
          </div>
        </div>
      </div>`,
    onMount: () => {
      requestAnimationFrame(() => {
        const element = $('#fullMap');
        if (!element) return;
        sheetMap = createMap(element, {
          lat: place.lat,
          lon: place.lon,
          zoom: place.zoom,
          interactive: true,
          showPin: true,
          marker: { lat: place.lat, lon: place.lon },
          theme: resolvedTheme(),
          onUserMove: () => {
            ui.mapFollow = false;
            updateMapLivePanel();
          },
        });
        if (sheetMap) sheetMap.invalidate();
        updateMapLivePanel();
      });
    },
    onClose: () => {
      if (sheetMap) {
        sheetMap.destroy();
        sheetMap = null;
      }
    },
  });
}

function accuracyText() {
  return state.location.accuracy
    ? `Doğruluk ±${Math.round(state.location.accuracy)} m`
    : 'Canlı GPS';
}

function updateMapLivePanel() {
  if (ui.sheetKind !== 'map' || !hasLocation()) return;
  const name = locationLabel();
  const coords = formatCoords(state.location.lat, state.location.lon);
  const accuracy = accuracyText();
  const topName = $('#mapPlaceName');
  const liveName = $('#mapLiveName');
  const detail = $('#mapPlaceDetail');
  const coordsElement = $('#mapLiveCoords');
  const accuracyElement = $('#mapLiveAccuracy');
  const updated = $('#mapLiveUpdated');
  if (topName) topName.textContent = name;
  if (liveName) liveName.textContent = name;
  if (detail) detail.textContent = state.location.detail || 'Canlı konum';
  if (coordsElement) coordsElement.textContent = coords;
  if (accuracyElement) accuracyElement.textContent = accuracy;
  if (updated) {
    updated.textContent = state.location.updatedAt
      ? `${formatRelativeTime(state.location.updatedAt)} güncellendi`
      : 'şimdi';
  }
  const recenter = $('.map-recenter');
  if (recenter) recenter.classList.toggle('is-live-follow', ui.mapFollow);
}

function recenterMap() {
  if (!hasLocation() || !sheetMap) return;
  ui.mapFollow = true;
  sheetMap.setView(state.location.lat, state.location.lon, 16, false);
  sheetMap.setMarker(state.location.lat, state.location.lon);
  updateMapLivePanel();
}

/* -------------------------------------------------------------------------- */
/*  sheets                                                                    */
/* -------------------------------------------------------------------------- */

function openSheet({ title = '', subtitle = '', content = '', kind = 'generic', variant = '', onMount, onClose }) {
  closeSheet({ immediate: true });

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const titleId = createId('sheet-title-');
  overlay.innerHTML = `
    <div class="overlay__backdrop" data-sheet-close></div>
    <section class="sheet ${variant === 'full' ? 'sheet--full' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <div class="sheet__grabber"></div>
      <header class="sheet__head">
        <div>
          <h2 class="sheet__title" id="${titleId}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="sheet__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="sheet__close" type="button" data-sheet-close aria-label="Kapat">${icon('x')}</button>
      </header>
      <div class="sheet__body">${content}</div>
    </section>`;
  document.body.appendChild(overlay);
  document.body.classList.add('sheet-open');

  const sheetElement = overlay.querySelector('.sheet');
  const body = overlay.querySelector('.sheet__body');
  const previousFocus = document.activeElement;
  const sheet = {
    overlay,
    element: sheetElement,
    body,
    kind,
    onClose,
    previousFocus,
    close: (options) => closeSheet(options),
  };
  ui.sheet = sheet;
  ui.sheetKind = kind;

  const keyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
    }
    if (event.key === 'Tab') {
      const focusable = $$(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        sheetElement,
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  overlay.addEventListener('keydown', keyHandler);
  sheet.keyHandler = keyHandler;

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-close]')) {
      closeSheet();
    }
  });

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    sheetElement.focus({ preventScroll: true });
    onMount?.(sheet);
  });

  return sheet;
}

function closeSheet({ immediate = false } = {}) {
  const sheet = ui.sheet;
  if (!sheet) return;
  ui.sheet = null;
  ui.sheetKind = '';
  sheet.onClose?.();
  sheet.overlay.removeEventListener('keydown', sheet.keyHandler);
  const finish = () => {
    sheet.overlay.remove();
    if (!document.querySelector('.overlay')) {
      document.body.classList.remove('sheet-open');
    }
    if (sheet.previousFocus?.focus) {
      try {
        sheet.previousFocus.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }
  };

  if (immediate) {
    finish();
    return;
  }
  sheet.overlay.classList.remove('is-open');
  setTimeout(finish, 290);
}

/* -------------------------------------------------------------------------- */
/*  lesson editor                                                             */
/* -------------------------------------------------------------------------- */

function openLessonSheet(lessonId = null, defaultDay = null) {
  const lesson = lessonId ? state.lessons.find((item) => item.id === lessonId) : null;
  const day = lesson
    ? Number(lesson.day)
    : Number(defaultDay || ui.scheduleDay) || dayNumber();
  const isEditing = Boolean(lesson);
  let deleteArmed = false;

  const sheet = openSheet({
    title: isEditing ? 'Dersi düzenle' : 'Yeni ders',
    subtitle: isEditing ? 'Bilgileri güncelle veya dersi kaldır.' : 'Dersin saatini ve yerini ekle.',
    kind: 'lesson',
    content: `
      <form class="form" data-form="lesson" data-id="${lesson ? escapeHtml(lesson.id) : ''}">
        <label class="field">
          <span>Ders adı</span>
          <input name="title" maxlength="90" required value="${escapeHtml(lesson?.title || '')}" placeholder="Örn. Sağlık Sosyolojisi" autocomplete="off" />
        </label>
        <label class="field">
          <span>Gün</span>
          <select name="day">
            ${DAYS.map((item) => `<option value="${item.id}" ${item.id === day ? 'selected' : ''}>${item.name}</option>`).join('')}
          </select>
        </label>
        <div class="field-row">
          <label class="field"><span>Başlangıç</span><input name="start" type="time" value="${escapeHtml(lesson?.start || '09:00')}" required /></label>
          <label class="field"><span>Bitiş</span><input name="end" type="time" value="${escapeHtml(lesson?.end || '10:40')}" required /></label>
        </div>
        <label class="field">
          <span>Derslik / Amfi</span>
          <input name="place" maxlength="60" value="${escapeHtml(lesson?.place || '')}" placeholder="Örn. Amfi 2, Derslik 104" autocomplete="off" />
        </label>
        <div class="form-error" data-form-error></div>
        <div class="form-actions">
          <button class="primary" type="submit">${icon('check')} ${isEditing ? 'Güncelle' : 'Dersi ekle'}</button>
          <button class="secondary" type="button" data-sheet-close>Vazgeç</button>
        </div>
        ${isEditing ? `<button class="delete-btn" type="button" data-action="delete-lesson" data-id="${escapeHtml(lesson.id)}">${icon('trash')} Dersi sil</button>` : ''}
      </form>`,
  });

  if (!sheet) return;
  sheet.deleteArmed = () => {
    if (!deleteArmed) {
      deleteArmed = true;
      const button = $('[data-action="delete-lesson"]', sheet.element);
      if (button) {
        button.classList.add('is-armed');
        button.innerHTML = `${icon('trash')} Silmeyi onayla`;
      }
      return false;
    }
    return true;
  };
}

function saveLesson(form) {
  const data = new FormData(form);
  const id = form.dataset.id;
  const title = String(data.get('title') || '').trim();
  const day = Number(data.get('day')) || 1;
  const start = String(data.get('start') || '');
  const end = String(data.get('end') || '');
  const place = String(data.get('place') || '').trim();
  const errorBox = $('[data-form-error]', form);

  const fail = (message) => {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.classList.add('is-visible');
    }
    return false;
  };

  if (!title) return fail('Ders adı gerekli.');
  if (!start || !end) return fail('Başlangıç ve bitiş saatini seç.');
  if (minutesFromTime(end) <= minutesFromTime(start)) return fail('Bitiş saati başlangıçtan sonra olmalı.');

  const overlap = state.lessons.find(
    (lesson) =>
      lesson.id !== id &&
      Number(lesson.day) === day &&
      minutesFromTime(start) < minutesFromTime(lesson.end) &&
      minutesFromTime(end) > minutesFromTime(lesson.start),
  );
  if (overlap) {
    return fail(`Bu saat aralığında “${overlap.title}” dersi var. Lütfen saati kontrol et.`);
  }

  if (id) {
    const lesson = state.lessons.find((item) => item.id === id);
    if (lesson) Object.assign(lesson, { title, day, start, end, place });
  } else {
    state.lessons.push({ id: createId('l_'), title, day, start, end, place });
  }
  state.ui.scheduleDay = day;
  ui.scheduleDay = day;
  persist();
  closeSheet();
  renderAll();
  showToast(id ? 'Ders güncellendi.' : 'Ders eklendi.');
  return true;
}

function deleteLesson(id) {
  state.lessons = state.lessons.filter((lesson) => lesson.id !== id);
  persist();
  closeSheet();
  renderAll();
  showToast('Ders silindi.');
}

/* -------------------------------------------------------------------------- */
/*  notes                                                                     */
/* -------------------------------------------------------------------------- */

function openNoteSheet() {
  ui.noteMood = 'love';
  openSheet({
    title: 'Küçük bir not',
    subtitle: 'Eşin bir sonraki açılışında görecek.',
    kind: 'note',
    content: `
      <form class="form note-composer" data-form="note">
        <label class="field">
          <span>Notun</span>
          <textarea name="text" maxlength="180" rows="4" required placeholder="Bugün aklımda kalan tek şey…" data-note-text></textarea>
        </label>
        <div class="field">
          <span>Hissi</span>
          <div class="mood-picker">
            ${NOTE_MOODS.map(
              (mood) => `
                <label class="mood-chip ${mood.id === 'love' ? 'is-selected' : ''}">
                  <input type="radio" name="mood" value="${mood.id}" ${mood.id === 'love' ? 'checked' : ''} />
                  <span>${mood.emoji}</span>${mood.label}
                </label>`,
            ).join('')}
          </div>
        </div>
        <div class="char-count"><span data-char-count>0</span> / 180</div>
        <div class="form-error" data-form-error></div>
        <div class="form-actions">
          <button class="primary" type="submit">${icon('send')} Bırak</button>
          <button class="secondary" type="button" data-sheet-close>Vazgeç</button>
        </div>
      </form>`,
    onMount: () => {
      updateMoodSelection();
      const textarea = $('[data-note-text]');
      const count = $('[data-char-count]');
      textarea?.addEventListener('input', () => {
        if (count) count.textContent = String(textarea.value.length);
      });
      textarea?.focus();
    },
  });
}

function updateMoodSelection() {
  $$('.mood-chip').forEach((chip) => {
    const input = chip.querySelector('input');
    chip.classList.toggle('is-selected', Boolean(input?.checked));
  });
}

function saveNote(form) {
  const data = new FormData(form);
  const text = String(data.get('text') || '').trim();
  const mood = String(data.get('mood') || 'love');
  if (!text) {
    const box = $('[data-form-error]', form);
    if (box) {
      box.textContent = 'Birkaç kelime de olsa bir şey yaz.';
      box.classList.add('is-visible');
    }
    return;
  }
  appendEvent({ type: 'note', text: text.slice(0, 180), mood });
  closeSheet();
  renderUs();
  showToast('Notun bahçeye bırakıldı.');
}

function deleteNote(id) {
  appendEvent({ type: 'note-delete', targetId: id });
  renderUs();
  showToast('Not silindi.');
}

/* -------------------------------------------------------------------------- */
/*  couple actions                                                            */
/* -------------------------------------------------------------------------- */

function appendEvent(payload) {
  const event = {
    id: createId('ev_'),
    uid: state.couple.uid,
    name: state.profile.name,
    ts: Date.now(),
    ...payload,
  };
  state.couple.events.push(event);
  if (state.couple.events.length > 1200) {
    state.couple.events = state.couple.events.slice(-1000);
  }
  persist();
  if (cloudEnabled()) {
    writeEvent(event)
      .then(() => {
        ui.cloudState = 'connected';
        ui.cloudError = '';
        const index = state.couple.outbox.indexOf(event.id);
        if (index >= 0) state.couple.outbox.splice(index, 1);
        persistSoon();
      })
      .catch((error) => {
        if (!state.couple.outbox.includes(event.id)) state.couple.outbox.push(event.id);
        ui.cloudState = navigator.onLine ? 'error' : 'offline';
        ui.cloudError = prettySyncError(error);
        persistSoon();
        renderUs();
      });
  }
  return event;
}

function waterGarden() {
  const couple = deriveCouple();
  if (!couple.canWater) {
    showToast('Bugünlük yeterince suladın. Yarın yine birlikte büyütürsünüz.');
    return;
  }
  appendEvent({ type: 'water', date: couple.today });
  renderUs();
  const terrarium = $('#terrarium');
  if (terrarium) {
    terrarium.classList.add('is-watering');
    setTimeout(() => terrarium.classList.remove('is-watering'), 1700);
  }
  showToast('Bir damla daha. Bahçe büyüyor.', { iconName: 'droplet' });
}

function sendHeart() {
  const ts = Date.now();
  state.couple.pulses[state.couple.uid] = {
    uid: state.couple.uid,
    name: state.profile.name,
    ts,
  };
  persist();
  animateHearts();
  showToast('Kalbin yola çıktı.');
  if (cloudEnabled()) {
    writePulse(state, ts).catch((error) => {
      ui.cloudState = navigator.onLine ? 'error' : 'offline';
      ui.cloudError = prettySyncError(error);
      renderUs();
    });
  }
}

function animateHearts(incoming = false) {
  const burst = document.createElement('div');
  burst.className = 'heart-burst';
  const count = incoming ? 14 : 9;
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'heart-burst__heart';
    heart.style.left = `${42 + Math.random() * 16}%`;
    heart.style.setProperty('--drift', `${(Math.random() - 0.5) * 230}px`);
    heart.style.setProperty('--scale', `${0.55 + Math.random() * 0.8}`);
    heart.style.setProperty('--rot', `${(Math.random() - 0.5) * 60}deg`);
    heart.style.animationDelay = `${Math.random() * 0.35}s`;
    heart.innerHTML = icon('heartFilled');
    burst.appendChild(heart);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 3200);
}

function handlePulses() {
  if (!cloudEnabled()) return;
  const beats = Object.values(state.couple.pulses || {});
  const incoming = beats
    .filter(
      (pulse) =>
        pulse?.uid &&
        pulse.uid !== state.couple.uid &&
        Number(pulse.ts) > ui.seenPulse &&
        Date.now() - Number(pulse.ts) < 120000,
    )
    .sort((a, b) => Number(b.ts) - Number(a.ts))[0];
  if (!incoming) return;
  ui.seenPulse = Number(incoming.ts);
  state.couple.seenPulse = ui.seenPulse;
  persistSoon();
  const partnerName = deriveCouple().partnerName;
  animateHearts(true);
  showToast(`${partnerName} sana bir kalp gönderdi.`);
}

/* -------------------------------------------------------------------------- */
/*  cloud sync                                                                */
/* -------------------------------------------------------------------------- */

function startCloudRuntime() {
  clearInterval(cloudTimer);
  clearInterval(heartbeatTimer);
  ui.cloudState = cloudEnabled() ? 'connecting' : 'local';
  if (!cloudEnabled()) return;

  syncNow();
  writePresence(state).catch(() => {});
  cloudTimer = setInterval(() => {
    if (document.visibilityState === 'visible') syncNow();
  }, 8000);
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && cloudEnabled()) {
      writePresence(state).catch(() => {});
    }
  }, 60000);
}

async function syncNow() {
  if (ui.syncing || !cloudEnabled() || !navigator.onLine) {
    if (!navigator.onLine && cloudEnabled()) ui.cloudState = 'offline';
    return;
  }
  ui.syncing = true;
  try {
    await flushOutbox();
    const remote = await fetchSpace();
    mergeRemote(remote);
    state.couple.lastSync = Date.now();
    ui.cloudState = 'connected';
    ui.cloudError = '';
    persist();
    renderUs();
    handlePulses();
  } catch (error) {
    ui.cloudState = navigator.onLine ? 'error' : 'offline';
    ui.cloudError = prettySyncError(error);
    renderUs();
  } finally {
    ui.syncing = false;
  }
}

async function flushOutbox() {
  if (!state.couple.outbox.length) return;
  const remaining = [];
  for (const id of state.couple.outbox.slice(0, 40)) {
    const event = state.couple.events.find((item) => item.id === id);
    if (!event) continue;
    try {
      await writeEvent(event);
    } catch {
      remaining.push(id);
    }
  }
  state.couple.outbox = [...new Set([...remaining, ...state.couple.outbox.slice(40)])];
  persistSoon();
}

function mergeRemote(remote) {
  const eventMap = new Map(state.couple.events.map((event) => [event.id, event]));
  Object.entries(remote.events || {}).forEach(([id, event]) => {
    if (event && typeof event === 'object') eventMap.set(id, { ...event, id });
  });
  state.couple.events = [...eventMap.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (state.couple.events.length > 1200) state.couple.events = state.couple.events.slice(-1000);
  state.couple.presence = remote.presence || {};
  state.couple.pulses = { ...(state.couple.pulses || {}), ...(remote.pulses || {}) };
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.warn('Service worker kaydedilemedi:', error);
  });
}

/* -------------------------------------------------------------------------- */
/*  events                                                                    */
/* -------------------------------------------------------------------------- */

function bindGlobalEvents() {
  document.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      event.preventDefault();
      showTab(tabButton.dataset.tab);
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    event.preventDefault();
    handleAction(actionButton);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const type = form.dataset.form;
    if (!type) return;
    event.preventDefault();

    if (type === 'lesson') saveLesson(form);
    else if (type === 'note') saveNote(form);
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-note-text]')) {
      const count = document.querySelector('[data-char-count]');
      if (count) count.textContent = String(event.target.value.length);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('.mood-chip input')) updateMoodSelection();
  });

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  window.addEventListener('pagehide', () => {
    if (cloudEnabled()) clearPresence(state).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (cloudEnabled()) writePresence(state).catch(() => {});
      if (hasLocation() && !weatherIsFresh()) refreshWeather();
      if (cloudEnabled()) syncNow();
    }
  });

  window.addEventListener('hashchange', () => {
    const tab = tabFromHash();
    if (tab !== activeTab) showTab(tab, { updateHash: false });
  });
}

function handleAction(element) {
  const action = element.dataset.action;
  switch (action) {
    case 'toggle-theme': {
      state.settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
      persist();
      applyTheme();
      renderAll();
      break;
    }
    case 'request-location':
      requestLocation();
      break;
    case 'open-weather':
      openWeatherSheet();
      break;
    case 'open-map':
      openMapSheet();
      break;
    case 'select-day':
      ui.scheduleDay = Number(element.dataset.day);
      state.ui.scheduleDay = ui.scheduleDay;
      persistSoon();
      renderSchedule();
      break;
    case 'add-lesson':
      openLessonSheet(null, element.dataset.day ? Number(element.dataset.day) : null);
      break;
    case 'edit-lesson':
      openLessonSheet(element.dataset.id);
      break;
    case 'delete-lesson': {
      const sheet = ui.sheet;
      if (sheet?.deleteArmed?.()) deleteLesson(element.dataset.id);
      break;
    }
    case 'refresh-weather':
      if (!hasLocation()) requestLocation();
      else refreshWeather({ force: true });
      break;
    case 'map-zoom-in':
      sheetMap?.zoomIn();
      break;
    case 'map-zoom-out':
      sheetMap?.zoomOut();
      break;
    case 'map-recenter':
      recenterMap();
      break;
    case 'water':
      waterGarden();
      break;
    case 'send-heart':
      sendHeart();
      break;
    case 'add-note':
      openNoteSheet();
      break;
    case 'delete-note':
      deleteNote(element.dataset.id);
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------------------- */
/*  toast                                                                     */
/* -------------------------------------------------------------------------- */

function showToast(message, { type = 'success', iconName = '' } = {}) {
  const root = $('#toastRoot');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
  toast.innerHTML = `${icon(iconName || (type === 'error' ? 'info' : 'check'))}<span>${escapeHtml(message)}</span>`;
  root.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 280);
  }, 3100);
}

/* -------------------------------------------------------------------------- */
/*  expose a few things for debugging / manual tests                          */
/* -------------------------------------------------------------------------- */

window.SemaApp = {
  get state() {
    return state;
  },
  showTab,
  refreshWeather,
  showToast,
  version: APP_VERSION,
};
