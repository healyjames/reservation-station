import type { CalendarDate } from '../types/calendar';
import type { TenantConfig } from '../types/tenant';
import { DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME, SLOT_INTERVAL_MINUTES } from '@constants';

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  for (let mins = open; mins < close; mins += SLOT_INTERVAL_MINUTES) {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

export function getSlotsForDate(date: CalendarDate, tenantConfig: TenantConfig | null): string[] {
  const hours = tenantConfig?.opening_hours;
  if (!hours || hours.length === 0) return generateTimeSlots(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME);

  // Use UTC noon to avoid DST edge cases when computing day-of-week
  const dateStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T12:00:00Z`;
  const dow = new Date(dateStr).getUTCDay();

  const entry = hours.find((h) => Number(h.day_of_week) === dow);
  if (!entry || entry.is_closed) return [];
  if (!entry.open_time || !entry.close_time) return generateTimeSlots(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME);
  return generateTimeSlots(entry.open_time, entry.close_time);
}

export function getEarliestTodaySlot(): string {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const thresholdMinutes = Math.ceil((currentMinutes + 30) / 30) * 30;
  const h = Math.floor(thresholdMinutes / 60);
  const m = thresholdMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getAvailableSlots(date: CalendarDate, tenantConfig: TenantConfig | null, blockedTimes: string[]): string[] {
  let slots = getSlotsForDate(date, tenantConfig).filter((s) => !blockedTimes.includes(s));
  if (isToday(date)) {
    const earliest = getEarliestTodaySlot();
    slots = slots.filter((s) => s >= earliest);
  }
  return slots;
}

function isToday(date: CalendarDate): boolean {
  const now = new Date();
  return date.year === now.getFullYear() && date.month === now.getMonth() && date.day === now.getDate();
}
