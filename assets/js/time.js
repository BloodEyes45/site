import { DAYS } from './data.js';
import { minutesFromTime } from './state.js';

export const TR_LOCALE = 'tr-TR';
export const TR_TZ = 'Europe/Istanbul';

const longDateFormatter = new Intl.DateTimeFormat(TR_LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const dayMonthFormatter = new Intl.DateTimeFormat(TR_LOCALE, {
  day: 'numeric',
  month: 'long',
});

const weekdayFormatter = new Intl.DateTimeFormat(TR_LOCALE, {
  weekday: 'long',
});

const clockFormatter = new Intl.DateTimeFormat(TR_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const hourFormatter = new Intl.DateTimeFormat(TR_LOCALE, {
  hour: '2-digit',
  hour12: false,
});

export function capitalize(value = '') {
  return value ? value.charAt(0).toLocaleUpperCase(TR_LOCALE) + value.slice(1) : value;
}

export function dayNumber(date = new Date()) {
  return ((date.getDay() + 6) % 7) + 1;
}

export function dayInfo(dayId) {
  return DAYS.find((day) => day.id === Number(dayId)) || DAYS[0];
}

export function formatLongDate(date = new Date()) {
  return capitalize(longDateFormatter.format(date));
}

export function formatDayMonth(date = new Date()) {
  return dayMonthFormatter.format(date);
}

export function formatWeekday(date = new Date()) {
  return capitalize(weekdayFormatter.format(date));
}

export function formatClock(date = new Date()) {
  return clockFormatter.format(date);
}

export function formatHour(date = new Date()) {
  return hourFormatter.format(date);
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function weekDates(date = new Date()) {
  const start = startOfWeek(date);
  return DAYS.map((day, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return { ...day, date: value, dateKey: dateKey(value) };
  });
}

export function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'Günaydın';
  if (hour >= 11 && hour < 17) return 'İyi günler';
  if (hour >= 17 && hour < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

export function isDaytime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 6 && hour < 20;
}

export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function lessonStatus(lesson, now = new Date(), dayOverride = null) {
  const currentDay = dayOverride ?? dayNumber(now);
  if (Number(lesson.day) !== currentDay) return 'other';
  const start = minutesFromTime(lesson.start);
  const end = minutesFromTime(lesson.end);
  const minutes = nowMinutes(now);
  if (minutes < start) return 'upcoming';
  if (minutes >= end) return 'done';
  return 'live';
}

export function sortedLessons(lessons, day) {
  return lessons
    .filter((lesson) => Number(lesson.day) === Number(day))
    .sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start));
}

export function nextLesson(lessons, now = new Date()) {
  const today = dayNumber(now);
  const minutes = nowMinutes(now);
  const days = [...DAYS.slice(today - 1), ...DAYS.slice(0, today - 1)];
  for (const day of days) {
    const items = sortedLessons(lessons, day.id);
    for (const lesson of items) {
      if (day.id !== today || minutesFromTime(lesson.end) > minutes) {
        return { lesson, day, dateOffset: (day.id - today + 7) % 7 };
      }
    }
  }
  return null;
}

export function todaySummary(lessons, now = new Date()) {
  const today = dayNumber(now);
  const items = sortedLessons(lessons, today);
  const minutes = nowMinutes(now);
  const live = items.find(
    (lesson) => minutes >= minutesFromTime(lesson.start) && minutes < minutesFromTime(lesson.end),
  );
  const upcoming = items.find((lesson) => minutes < minutesFromTime(lesson.start));
  const done = items.filter((lesson) => minutes >= minutesFromTime(lesson.end));

  if (live) return { kind: 'live', lesson: live, items, done };
  if (upcoming) return { kind: 'upcoming', lesson: upcoming, items, done };
  if (items.length) return { kind: 'done', lesson: null, items, done };
  return { kind: 'empty', lesson: null, items, done };
}

export function relativeLessonLabel(day, dateOffset = 0) {
  if (dateOffset === 0) return 'bugün';
  if (dateOffset === 1) return 'yarın';
  if (dateOffset === 2) return 'öbür gün';
  return `${day.name} günü`;
}

export function timeNowIso() {
  return new Date().toISOString();
}
