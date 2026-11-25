import { dayNumber, nowMinutes, sortedLessons, dateKey } from './time.js';
import { minutesFromTime } from './state.js';
import { cloudEnabled, writeNode } from './sync.js';
import { firebaseConfig } from './firebase-config.js';

const REMINDED_KEY = 'sema-reminded-v1';
const CHECK_INTERVAL = 20000;

export const LEAD_OPTIONS = [5, 10, 15, 30];

let checkTimer = null;
let lastDue = null;

export function reminderSettings(state) {
  const source = state?.settings?.reminders || {};
  const lead = LEAD_OPTIONS.includes(Number(source.lead)) ? Number(source.lead) : 10;
  return {
    enabled: source.enabled !== false,
    lead,
    push: Boolean(source.push),
  };
}

export function setReminderSettings(state, patch) {
  state.settings.reminders = { ...reminderSettings(state), ...patch };
  return state.settings.reminders;
}

function readReminded() {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDED_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeReminded(map) {
  try {
    const keys = Object.keys(map);
    if (keys.length > 240) {
      keys.slice(0, keys.length - 200).forEach((key) => delete map[key]);
    }
    localStorage.setItem(REMINDED_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

export function reminderKey(lesson, now = new Date()) {
  return `${dateKey(now)}|${lesson.id}`;
}

export function markReminded(lesson, now = new Date()) {
  const map = readReminded();
  map[reminderKey(lesson, now)] = Date.now();
  writeReminded(map);
}

export function dueReminder(state, now = new Date()) {
  const settings = reminderSettings(state);
  if (!settings.enabled) return null;
  if (document.visibilityState === 'hidden') return null;

  const today = dayNumber(now);
  const minutes = nowMinutes(now);
  const lessons = sortedLessons(state.lessons || [], today);
  const reminded = readReminded();

  for (const lesson of lessons) {
    const start = minutesFromTime(lesson.start);
    const remaining = start - minutes;
    if (remaining <= 0 || remaining > settings.lead) continue;
    if (reminded[reminderKey(lesson, now)]) continue;
    return { lesson, remaining, lead: settings.lead };
  }
  return null;
}

export function startReminderRuntime({ getState, onDue }) {
  clearInterval(checkTimer);
  const tick = () => {
    const state = getState();
    if (!state || document.visibilityState === 'hidden') return;
    const due = dueReminder(state);
    if (!due) return;
    if (lastDue && lastDue.key === reminderKey(due.lesson)) return;
    lastDue = { key: reminderKey(due.lesson), at: Date.now() };
    markReminded(due.lesson);
    onDue?.(due);

    const settings = reminderSettings(state);
    if (!settings.push) {
      showLocalNotification(due.lesson, due.remaining);
    }
  };
  checkTimer = setInterval(tick, CHECK_INTERVAL);
  setTimeout(tick, 2500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(tick, 800);
  });
  return () => clearInterval(checkTimer);
}

async function showLocalNotification(lesson, remaining) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return;
    await registration.showNotification('Ders yaklaşıyor', {
      body: `${lesson.title} · ${remaining} dk sonra${lesson.place ? ` · ${lesson.place}` : ''}`,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: `sema-lesson-${lesson.id}`,
      renotify: false,
      data: { url: './#bugun' },
    });
  } catch {
    // Bildirim desteklenmiyorsa uygulama içi uyarı yeterli.
  }
}

export function pushSupported() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(firebaseConfig.vapidPublicKey)
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function matchesVapidKey(subscription) {
  const current = subscription?.options?.applicationServerKey;
  if (!current) return false;
  const expected = base64UrlToBytes(firebaseConfig.vapidPublicKey);
  const actual = new Uint8Array(current);
  if (actual.length !== expected.length) return false;
  return actual.every((byte, index) => byte === expected[index]);
}

async function readyRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  const registration = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  return registration;
}

export async function pushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enablePush(state) {
  if (!pushSupported()) {
    return { ok: false, error: 'Bu tarayıcı arka plan bildirimlerini desteklemiyor.' };
  }
  if (isIos() && !isStandalone()) {
    return {
      ok: false,
      error: 'iPhone/iPad’de bildirim için önce Paylaş → Ana Ekrana Ekle ile uygulamayı yükle, sonra buradan aç.',
    };
  }
  if (Notification.permission === 'denied') {
    return { ok: false, error: 'Bildirim izni kapalı. Tarayıcı/telefon ayarlarından Sema’ya izin ver.' };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Bildirim izni verilmedi.' };
  }

  try {
    const registration = await readyRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !matchesVapidKey(subscription)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(firebaseConfig.vapidPublicKey),
      });
    }
    const saved = await savePushDevice(state, subscription);
    if (!saved) return { ok: false, error: 'Bildirim aboneliği buluta kaydedilemedi.' };
    setReminderSettings(state, { push: true });
    return { ok: true, subscription };
  } catch (error) {
    return { ok: false, error: error?.message || 'Bildirim aboneliği kurulamadı.' };
  }
}

export async function disablePush(state) {
  setReminderSettings(state, { push: false });
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      if (cloudEnabled()) {
        await writeNode(`push/devices/${encodeURIComponent(state.couple.uid)}`, null).catch(() => {});
      }
      return { ok: true, endpoint };
    }
  } catch {
    // Abonelik zaten kaldırılmış olabilir.
  }
  return { ok: true };
}

export async function savePushDevice(state, subscription) {
  if (!cloudEnabled()) return false;
  const json = subscription.toJSON ? subscription.toJSON() : {};
  const settings = reminderSettings(state);
  try {
    await writeNode(`push/devices/${encodeURIComponent(state.couple.uid)}`, {
      uid: state.couple.uid,
      name: state.profile.name,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
      },
      lead: settings.lead,
      enabled: true,
      updatedAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function updatePushDevice(state) {
  const settings = reminderSettings(state);
  if (!settings.push || !cloudEnabled()) return false;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;
    return await savePushDevice(state, subscription);
  } catch {
    return false;
  }
}

export async function syncSchedule(state) {
  if (!cloudEnabled()) return false;
  try {
    await writeNode('push/schedule', {
      timezone: 'Europe/Istanbul',
      lessons: (state.lessons || []).map((lesson) => ({
        id: lesson.id,
        day: Number(lesson.day),
        start: lesson.start,
        end: lesson.end,
        title: lesson.title,
        place: lesson.place || '',
      })),
      updatedAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendTestNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return { ok: false, error: 'Önce bildirim iznini aç.' };
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return { ok: false, error: 'Servis çalışanı hazır değil.' };
  await registration.showNotification('Sema · deneme', {
    body: 'Bildirimler çalışıyor. Ders hatırlatıcısı dersten önce burada görünecek.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'sema-test',
    data: { url: './#bugun' },
  });
  return { ok: true };
}
