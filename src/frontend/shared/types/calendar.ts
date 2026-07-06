import { MONTH_NAMES, DAY_NAMES } from '@constants';

export type CalendarDate = {
  year: number;
  /** 0-indexed: 0 = January, 11 = December */
  month: number;
  day: number;
}

export type MonthName = (typeof MONTH_NAMES)[number];
export type DayName = (typeof DAY_NAMES)[number];
