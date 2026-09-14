import type { Lang } from '../storage';
import type { Strings } from '../i18n/strings';

/**
 * Notes are stored in UTC and displayed in the reader's local time, because
 * "yesterday" means the reader's yesterday.
 */

export function toDate(iso: string): Date {
  return new Date(iso);
}

/** Local YYYY-MM-DD. The key a note is grouped and filed under. */
export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Today", "Yesterday", then the full date. */
export function dayLabel(iso: string, t: Strings, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(d) === dayKey(today)) return t.today;
  if (dayKey(d) === dayKey(yesterday)) return t.yesterday;

  const month = t.months[d.getMonth()];
  const weekday = t.weekdays[(d.getDay() + 6) % 7];
  return lang === 'ja'
    ? `${month}${d.getDate()}日 ${weekday}曜日`
    : `${weekday}, ${d.getDate()} ${month}`;
}

/** Short stamp for the pinned-urgent list: "Sep 11 · 09:12". */
export function shortStamp(iso: string, t: Strings, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = formatTime(iso);

  if (dayKey(d) === dayKey(today)) return time;
  if (dayKey(d) === dayKey(yesterday)) return `${t.yesterday} ${time}`;
  return lang === 'ja'
    ? `${d.getMonth() + 1}/${d.getDate()} ${time}`
    : `${t.months[d.getMonth()].slice(0, 3)} ${d.getDate()} · ${time}`;
}

/** Monday-first, matching both the UK and Japanese conventions. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Six Monday-first weeks covering the given month. */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return dayKey(d) === dayKey(new Date());
}

/** The value a <input type="date"> expects. */
export function dateInputValue(iso: string | null): string {
  return iso ? dayKey(new Date(iso)) : dayKey(new Date());
}

/** Turns a date input's YYYY-MM-DD back into a stored UTC timestamp at local noon. */
export function fromDateInput(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
