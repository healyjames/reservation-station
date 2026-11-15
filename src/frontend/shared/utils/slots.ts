import type { CalendarDate } from '../types/calendar';
import type { AdminDateOverride } from '../types/blockedDate';
import type { OpeningHoursEntry, TenantConfig } from '../types/tenant';
import { DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME, SLOT_INTERVAL_MINUTES } from '@constants';

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  for (let mins = open; mins < close; mins += SLOT_INTERVAL_MINUTES) {
    slots.push(toTime(mins));
  }
  return slots;
}

const MINUTES_IN_DAY = 24 * 60;
// The API has no "24:00", so a range that runs to the end of the day ends at 23:59.
const LATEST_BLOCK_END = '23:59';

type BlockTimeOptionsInput = {
  date: CalendarDate;
  openingHours: OpeningHoursEntry[] | null;
  /** Special hours set for this date, which replace the weekly opening hours. */
  specialHours?: AdminDateOverride | null;
  /** When set, only end times after this start are returned. */
  startTime?: string;
};

/**
 * Start and end choices for blocking a time range on `date`, bounded by that day's opening hours.
 * A block's end is exclusive, so each end option is a slot's finish (slot + one interval) and the
 * last one is closing time. Both lists are empty when the day is closed or its hours cross midnight.
 */
export function getBlockTimeOptions({ date, openingHours, specialHours, startTime }: BlockTimeOptionsInput): {
  startTimes: string[];
  endTimes: string[];
} {
  const startTimes = specialHours ? getSlotsForSpecialHours(specialHours) : getSlotsForOpeningHours(date, openingHours);
  const endTimes = startTimes
    .map((slot) => toMinutes(slot) + SLOT_INTERVAL_MINUTES)
    .map((end) => (end >= MINUTES_IN_DAY ? LATEST_BLOCK_END : toTime(end)))
    .filter((end) => !startTime || end > startTime);
  return { startTimes, endTimes };
}

function getSlotsForSpecialHours(specialHours: AdminDateOverride): string[] {
  if (specialHours.is_closed || !specialHours.open_time || !specialHours.close_time) return [];
  return generateTimeSlots(specialHours.open_time, specialHours.close_time);
}

/**
 * Choices for setting special opening hours on a date: any slot of the day to open at, and any later
 * slot boundary (up to the end of the day) to close at.
 */
export function getSpecialHoursOptions(openTime?: string): { openTimes: string[]; closeTimes: string[] } {
  const openTimes = generateTimeSlots('00:00', LATEST_BLOCK_END);
  const closeTimes = openTimes
    .map((slot) => toMinutes(slot) + SLOT_INTERVAL_MINUTES)
    .map((end) => (end >= MINUTES_IN_DAY ? LATEST_BLOCK_END : toTime(end)))
    .filter((end) => !openTime || end > openTime);
  return { openTimes, closeTimes };
}

/** The weekly opening hours for the weekday `date` falls on, or null when none are configured for it. */
export function getWeeklyHoursForDate(date: CalendarDate, hours: OpeningHoursEntry[] | null): OpeningHoursEntry | null {
  const dateStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T12:00:00Z`;
  const dow = new Date(dateStr).getUTCDay();
  return hours?.find((h) => Number(h.day_of_week) === dow) ?? null;
}

export function getSlotsForDate(date: CalendarDate, tenantConfig: TenantConfig | null): string[] {
  return getSlotsForOpeningHours(date, tenantConfig?.opening_hours ?? null);
}

/** Bookable slots on `date` for a weekly schedule. Falls back to the default hours when none are configured. */
export function getSlotsForOpeningHours(date: CalendarDate, hours: OpeningHoursEntry[] | null): string[] {
  if (!hours || hours.length === 0) return generateTimeSlots(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME);

  // Use UTC noon to avoid DST edge cases when computing day-of-week
  const dateStr = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T12:00:00Z`;
  const dow = new Date(dateStr).getUTCDay();

  const entry = hours.find((h) => Number(h.day_of_week) === dow);
  if (!entry || entry.is_closed) return [];
  if (!entry.open_time || !entry.close_time) return generateTimeSlots(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME);
  return generateTimeSlots(entry.open_time, entry.close_time);
}

export function getEarliestTodaySlot(leadMinutes = 30): string {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const thresholdMinutes = Math.ceil((currentMinutes + leadMinutes) / 30) * 30;
  const h = Math.floor(thresholdMinutes / 60);
  const m = thresholdMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * `daySlots` is the date's bookable start times as resolved by the server, which knows about special
 * hours set for that date. Without it the tenant's weekly opening hours are used.
 */
export function getAvailableSlots(
  date: CalendarDate,
  tenantConfig: TenantConfig | null,
  blockedTimes: string[],
  daySlots: string[] | null = null,
): string[] {
  let slots = (daySlots ?? getSlotsForDate(date, tenantConfig)).filter((s) => !blockedTimes.includes(s));
  if (isToday(date)) {
    // Honour the tenant's booking delay (lead time). The value rides along on the already-cached
    // tenant config, so this needs no extra API request. A 30-min minimum is always enforced.
    const delay = tenantConfig?.booking_delay_minutes ?? 0;
    const earliest = getEarliestTodaySlot(Math.max(30, delay));
    slots = slots.filter((s) => s >= earliest);
  }
  return slots;
}

function isToday(date: CalendarDate): boolean {
  const now = new Date();
  return date.year === now.getFullYear() && date.month === now.getMonth() && date.day === now.getDate();
}
