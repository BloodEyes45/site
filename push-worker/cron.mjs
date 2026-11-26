import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const DATABASE = 'https://semaasistan-9dca3-default-rtdb.firebaseio.com';
const SPACE = 'spaces/semaasistan';
const BASE = `${DATABASE}/${SPACE}`;
const TIME_ZONE = 'Europe/Istanbul';
const LEAD_OPTIONS = [5, 10, 15, 30];
// Bildirime dokununca açılacak adres. Mutlak olmalı; göreli adres site köküne (/site/ değil /) çözülüyordu.
const SITE_URL = 'https://bloodeyes45.github.io/site/';

function readPublicKey() {
  const workerDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.resolve(workerDir, '..', 'assets', 'js', 'firebase-config.js');
  const config = fs.readFileSync(configPath, 'utf8');
  const match = config.match(/vapidPublicKey\s*=\s*'([^']+)'/);
  if (!match) throw new Error('VAPID açık anahtarı firebase-config.js içinde bulunamadı.');
  return match[1];
}

function istanbulNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dayId: ((weekDay + 6) % 7) + 1,
    minutes: hour * 60 + minute,
    clock: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

async function read(pathname) {
  const response = await fetch(`${BASE}/${pathname}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Firebase okunamadı (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function write(pathname, value) {
  const response = await fetch(`${BASE}/${pathname}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase yazılamadı (${response.status})`);
}

async function remove(pathname) {
  const response = await fetch(`${BASE}/${pathname}.json`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Firebase silinemedi (${response.status})`);
}

function dueReminders(lessons, now, lead) {
  return lessons
    .filter((lesson) => Number(lesson.day) === now.dayId)
    .map((lesson) => ({
      lesson,
      remaining: minutesFromTime(lesson.start) - now.minutes,
    }))
    // GitHub cron birkaç dakika gecikebilir; ders başladıktan sonra 3 dakikaya kadar yakala.
    .filter(({ remaining }) => remaining <= lead && remaining > -3);
}

async function main() {
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || '').trim() || 'mailto:sema@example.com';
  if (!privateKey) {
    console.error('VAPID_PRIVATE_KEY yok. GitHub → Settings → Secrets and variables → Actions içine ekle.');
    process.exit(1);
  }

  const publicKey = readPublicKey();
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const now = istanbulNow();
  const [schedule, devices] = await Promise.all([read('push/schedule'), read('push/devices')]);
  const lessons = Array.isArray(schedule?.lessons) ? schedule.lessons : [];
  const targets = devices && typeof devices === 'object' ? Object.entries(devices) : [];
  console.log(`[${now.clock}] ${lessons.length} ders, ${targets.length} cihaz`);

  let sent = 0;
  for (const [deviceId, device] of targets) {
    if (!device?.endpoint || !device?.keys?.p256dh || !device?.keys?.auth) continue;
    if (device.enabled === false) continue;

    const lead = LEAD_OPTIONS.includes(Number(device.lead)) ? Number(device.lead) : 10;
    const due = dueReminders(lessons, now, lead);
    for (const { lesson, remaining } of due) {
      const sentPath = `push/sent/${now.dateKey}/${encodeURIComponent(lesson.id)}/${encodeURIComponent(deviceId)}`;
      if (await read(sentPath)) continue;

      const timing = remaining > 0 ? `${remaining} dk sonra` : 'şimdi başlıyor';
      const payload = {
        title: 'Ders yaklaşıyor',
        body: `${lesson.title} · ${timing}${lesson.place ? ` · ${lesson.place}` : ''}`,
        url: SITE_URL + '#bugun',
        tag: `sema-${now.dateKey}-${lesson.id}`,
      };

      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.keys.p256dh, auth: device.keys.auth } },
          JSON.stringify(payload),
          { TTL: 1800, urgency: 'high' },
        );
        await write(sentPath, Date.now());
        sent += 1;
        console.log(`gönderildi: ${lesson.title} → ${deviceId.slice(0, 8)}…`);
      } catch (error) {
        const status = Number(error?.statusCode);
        if (status === 404 || status === 410) {
          await remove(`push/devices/${encodeURIComponent(deviceId)}`).catch(() => {});
          console.log(`geçersiz abonelik silindi: ${deviceId.slice(0, 8)}…`);
        } else {
          console.error(`gönderilemedi (${status || '?'}): ${error?.message || error}`);
        }
      }
    }
  }

  await write('push/lastRun', { at: Date.now(), clock: now.clock, sent }).catch(() => {});
  console.log(`bitti: ${sent} bildirim`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
