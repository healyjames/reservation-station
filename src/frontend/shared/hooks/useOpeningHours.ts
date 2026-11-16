import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { OpeningHoursEntry } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';

export type UseOpeningHoursReturn = {
  /** The tenant's weekly schedule: `null` when none is configured, `undefined` until it has loaded. */
  openingHours: Signal<OpeningHoursEntry[] | null | undefined>;
  reloadOpeningHours: () => Promise<void>;
};

/** Loads the signed-in tenant's opening hours. The login response does not include them. */
export function useOpeningHours(getToken: () => string | null): UseOpeningHoursReturn {
  const openingHours = useSignal<OpeningHoursEntry[] | null | undefined>(undefined);

  async function reloadOpeningHours(): Promise<void> {
    const tok = getToken();
    if (!tok) return;

    try {
      const res = await adminFetch('/api/admin/opening-hours', tok);
      if (!res.ok) return;

      const body = (await res.json()) as { data?: OpeningHoursEntry[] };
      openingHours.value = body.data && body.data.length > 0 ? body.data : null;
    } catch {
      // Keep the last known value; the caller treats `undefined` as "not loaded".
    }
  }

  useEffect(() => {
    void reloadOpeningHours();
  }, []);

  return { openingHours, reloadOpeningHours };
}
