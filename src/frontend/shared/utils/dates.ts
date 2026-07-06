import type { CalendarDate } from '../types/calendar';

export function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateForAPI(date: CalendarDate): string {
  const month = String(date.month + 1).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

export function formatDateForDisplay(date: CalendarDate): string {
  return new Date(date.year, date.month, date.day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats an ISO date string (YYYY-MM-DD) for display.
 * Uses noon UTC to avoid off-by-one from timezone shifts.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Unknown date';
  return new Date(`${dateString}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function parseYYYYMMDD(dateString: string): CalendarDate {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month: month - 1, day }; // month is 0-indexed
}

export function isToday(date: CalendarDate): boolean {
  const now = new Date();
  return date.year === now.getFullYear() && date.month === now.getMonth() && date.day === now.getDate();
}

export function isSameDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
