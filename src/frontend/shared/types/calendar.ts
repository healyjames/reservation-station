/** Represents a calendar date as year/month(0-indexed)/day integers */
export interface CalendarDate {
  year: number;
  /** 0-indexed: 0 = January, 11 = December */
  month: number;
  day: number;
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type MonthName = (typeof MONTHS)[number];
export type DayName = (typeof DAY_NAMES)[number];
