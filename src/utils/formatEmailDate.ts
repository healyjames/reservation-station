import { DAYS, MONTHS } from '../constants';

export function formatEmailDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]}`;
}
