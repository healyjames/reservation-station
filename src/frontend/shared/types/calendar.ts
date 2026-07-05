import { MONTH_NAMES, DAY_NAMES } from '@constants';

/** Represents a calendar date as year/month(0-indexed)/day integers */
export interface CalendarDate {
  year: number;
  /** 0-indexed: 0 = January, 11 = December */
  month: number;
  day: number;
}

export type MonthName = (typeof MONTH_NAMES)[number];
export type DayName = (typeof DAY_NAMES)[number];
