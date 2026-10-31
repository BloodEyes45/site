import { firebaseConfig, sharedSpacePath } from './firebase-config.js';

const REQUEST_TIMEOUT = 12000;

export class SyncError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

export function cloudEnabled() {
  return Boolean(firebaseConfig.databaseURL && sharedSpacePath);
}

function spaceUrl() {
  const base = String(firebaseConfig.databaseURL || '').replace(/\/+$/, '');
  return `${base}/${sharedSpacePath}`;
}

async function requestJson(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SyncError(
          'Firebase Realtime Database izni gerekiyor. Veritabanı kurallarını kontrol et.',
          response.status,
        );
      }
      if (response.status === 404) {
        throw new SyncError('Firebase veritabanı bulunamadı.', 404);
      }
      throw new SyncError(`Bulut isteği başarısız oldu (${response.status}).`, response.status);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.name === 'AbortError') throw new SyncError('Bulut isteği zaman aşımına uğradı.');
    if (error instanceof SyncError) throw error;
    throw new SyncError('Buluta ulaşılamadı. İnternet bağlantısını kontrol et.');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSpace() {
  const data = await requestJson(`${spaceUrl()}.json`);
  return {
    events: data?.events && typeof data.events === 'object' ? data.events : {},
    presence: data?.presence && typeof data.presence === 'object' ? data.presence : {},
    pulses: data?.pulses && typeof data.pulses === 'object' ? data.pulses : {},
  };
}

export async function writeEvent(event) {
  const url = `${spaceUrl()}/events/${encodeURIComponent(event.id)}.json`;
  await requestJson(url, { method: 'PUT', body: JSON.stringify(event) });
  return true;
}

export async function writePresence(state) {
  const url = `${spaceUrl()}/presence/${encodeURIComponent(state.couple.uid)}.json`;
  await requestJson(url, {
    method: 'PUT',
    body: JSON.stringify({
      uid: state.couple.uid,
      name: state.profile.name,
      ts: Date.now(),
    }),
  });
  return true;
}

export async function clearPresence(state) {
  if (!cloudEnabled()) return;
  try {
    const url = `${spaceUrl()}/presence/${encodeURIComponent(state.couple.uid)}.json`;
    await fetch(url, { method: 'DELETE', keepalive: true, cache: 'no-store' });
  } catch {
    // Kapanırken sessizce dene.
  }
}

export async function writePulse(state, ts = Date.now()) {
  const url = `${spaceUrl()}/pulses/${encodeURIComponent(state.couple.uid)}.json`;
  await requestJson(url, {
    method: 'PUT',
    body: JSON.stringify({
      uid: state.couple.uid,
      name: state.profile.name,
      ts,
    }),
  });
  return true;
}

export function prettySyncError(error) {
  if (error instanceof SyncError) return error.message;
  return 'Bulut bağlantısında bilinmeyen bir sorun oluştu.';
}
