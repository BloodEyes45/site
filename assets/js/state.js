import { seedLessons } from './data.js';

export const STORAGE_KEY = 'sema-app-state-v3';

export function createId(prefix = '') {
  const random = (() => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    return Math.random().toString(36).slice(2, 10);
  })();
  return `${prefix}${Date.now().toString(36)}${random}`;
}

export function defaultState() {
  return {
    version: 4,
    createdAt: Date.now(),
    profile: {
      name: 'Sema',
      partnerName: 'Aşkım',
    },
    settings: {
      theme: 'light',
      reduceMotion: false,
    },
    location: {
      name: '',
      detail: '',
      lat: null,
      lon: null,
      accuracy: null,
      updatedAt: 0,
      source: 'unknown',
    },
    lessons: [],
    weather: {
      key: '',
      fetchedAt: 0,
      data: null,
    },
    couple: {
      uid: createId('u_'),
      events: [],
      pulses: {},
      presence: {},
      outbox: [],
      lastSync: 0,
      seenPulse: 0,
    },
    ui: {
      lastTab: 'today',
      scheduleDay: null,
    },
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const state = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    location: {
      ...base.location,
      ...(raw.location || {}),
      lat: Number.isFinite(Number(raw.location?.lat)) ? Number(raw.location.lat) : null,
      lon: Number.isFinite(Number(raw.location?.lon)) ? Number(raw.location.lon) : null,
      accuracy: Number.isFinite(Number(raw.location?.accuracy)) ? Number(raw.location.accuracy) : null,
    },
    lessons: Array.isArray(raw.lessons) ? raw.lessons.filter(Boolean) : base.lessons,
    weather: { ...base.weather, ...(raw.weather || {}) },
    couple: {
      ...base.couple,
      ...(raw.couple || {}),
      events: Array.isArray(raw.couple?.events) ? raw.couple.events : [],
      outbox: Array.isArray(raw.couple?.outbox) ? raw.couple.outbox : [],
      pulses: raw.couple?.pulses && typeof raw.couple.pulses === 'object' ? raw.couple.pulses : {},
      presence: raw.couple?.presence && typeof raw.couple.presence === 'object' ? raw.couple.presence : {},
    },
    ui: { ...base.ui, ...(raw.ui || {}) },
  };

  if (!state.couple.uid) state.couple.uid = createId('u_');
  if (!state.profile.name) state.profile.name = 'Sema';
  if (!state.profile.partnerName) state.profile.partnerName = 'Aşkım';

  state.lessons = state.lessons.map((lesson) => ({
    id: lesson.id || createId('l_'),
    day: Number(lesson.day) || 1,
    start: lesson.start || '09:00',
    end: lesson.end || '10:00',
    title: String(lesson.title || 'İsimsiz ders').trim(),
    place: String(lesson.place || '').trim(),
  }));

  return state;
}

export function loadState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    raw = null;
  }

  const state = normalizeState(raw);
  if (!raw?.lessons) {
    state.lessons = seedLessons();
    saveState(state);
  } else if (Number(raw.version || 0) < 4) {
    const geriatric = state.lessons.find((lesson) => lesson.id === 'seed-5') ||
      state.lessons.find(
        (lesson) => Number(lesson.day) === 2 && /Geriatrik Psikiyatri/i.test(lesson.title),
      );
    if (geriatric && !geriatric.place) geriatric.place = 'Derslik 6';
    state.version = 4;
    saveState(state);
  }
  return state;
}

let saveTimer = null;

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Durum kaydedilemedi:', error);
  }
}

export function saveStateSoon(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 180);
}

export function resetState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage may be unavailable
  }
  return defaultState();
}

export function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR') || '')
    .join('');
}

export function minutesFromTime(value = '00:00') {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function pluralTr(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
