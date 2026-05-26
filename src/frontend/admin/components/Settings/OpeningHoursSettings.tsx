import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import type { OpeningHoursEntry } from '@shared/types';
import { ToggleSwitch, Button } from '@shared/components';
import { adminFetch } from '../../utils/api';

interface DayConfig {
  label: string;
  dow: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

const DAY_ORDER: Array<{ label: string; dow: number }> = [
  { label: 'Monday',    dow: 1 },
  { label: 'Tuesday',   dow: 2 },
  { label: 'Wednesday', dow: 3 },
  { label: 'Thursday',  dow: 4 },
  { label: 'Friday',    dow: 5 },
  { label: 'Saturday',  dow: 6 },
  { label: 'Sunday',    dow: 0 },
];

interface OpeningHoursSettingsProps {
  token: string;
}

const OpeningHoursSettings: FunctionComponent<OpeningHoursSettingsProps> = ({ token }) => {
  const days = useSignal<DayConfig[]>(
    DAY_ORDER.map(({ label, dow }) => ({
      label, dow, isClosed: false, openTime: '12:00', closeTime: '22:00',
    }))
  );
  const isLoading = useSignal(true);
  const isSaving = useSignal(false);
  const bannerMessage = useSignal('');
  const bannerType = useSignal<'success' | 'error'>('success');

  useEffect(() => {
    loadHours();
  }, []);

  async function loadHours() {
    isLoading.value = true;
    try {
      const r = await adminFetch('/api/admin/opening-hours', token);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json() as { data?: OpeningHoursEntry[] };
      const data: OpeningHoursEntry[] = (json.data && json.data.length > 0) ? json.data : [];
      days.value = DAY_ORDER.map(({ label, dow }) => {
        const entry = data.find(e => e.day_of_week === dow);
        const isClosed = entry ? !!entry.is_closed : false;
        const openTime = (entry && !entry.is_closed && entry.open_time) ? entry.open_time : '12:00';
        const closeTime = (entry && !entry.is_closed && entry.close_time) ? entry.close_time : '22:00';
        return { label, dow, isClosed, openTime, closeTime };
      });
    } catch {
      showBanner('error', 'Failed to load opening hours.');
    } finally {
      isLoading.value = false;
    }
  }

  function showBanner(type: 'success' | 'error', message: string) {
    bannerType.value = type;
    bannerMessage.value = message;
    setTimeout(() => { bannerMessage.value = ''; }, 3500);
  }

  function updateDay(dow: number, patch: Partial<DayConfig>) {
    days.value = days.value.map(d => d.dow === dow ? { ...d, ...patch } : d);
  }

  async function handleSave() {
    isSaving.value = true;
    const body = days.value.map(d => ({
      day_of_week: d.dow,
      is_closed: d.isClosed,
      open_time:  d.isClosed ? null : d.openTime,
      close_time: d.isClosed ? null : d.closeTime,
    }));
    try {
      const r = await adminFetch('/api/admin/opening-hours', token, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      showBanner('success', 'Opening hours saved.');
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'Failed to save opening hours.');
    } finally {
      isSaving.value = false;
    }
  }

  if (isLoading.value) {
    return <p class="loading-text">Loading opening hours…</p>;
  }

  return (
    <div>
      <h3 class="oh-section-title">Opening Hours</h3>
      {bannerMessage.value && (
        <div class={`alert oh-banner alert-${bannerType.value}`} role="status" aria-live="polite">
          {bannerMessage.value}
        </div>
      )}

      {/* Desktop table view */}
      <table class="admin-table oh-schedule">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
            <th scope="col">Closed</th>
          </tr>
        </thead>
        <tbody>
          {days.value.map(d => (
            <tr key={d.dow} class="oh-row" data-dow={String(d.dow)}>
              <td class="oh-day-name">{d.label}</td>
              <td class="oh-time-cell">
                <input
                  type="time"
                  class="oh-open-time"
                  step={1800}
                  value={d.openTime}
                  disabled={d.isClosed}
                  style={d.isClosed ? 'opacity:0.25' : undefined}
                  onChange={(e) => updateDay(d.dow, { openTime: (e.target as HTMLInputElement).value })}
                />
              </td>
              <td class="oh-time-cell">
                <input
                  type="time"
                  class="oh-close-time"
                  step={1800}
                  value={d.closeTime}
                  disabled={d.isClosed}
                  style={d.isClosed ? 'opacity:0.25' : undefined}
                  onChange={(e) => updateDay(d.dow, { closeTime: (e.target as HTMLInputElement).value })}
                />
              </td>
              <td class="oh-closed-cell">
                <div class="oh-closed-label form-group-check">
                  <ToggleSwitch
                    id={`oh-toggle-${d.dow}`}
                    checked={d.isClosed}
                    label="Closed"
                    onChange={(checked) => updateDay(d.dow, { isClosed: checked })}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile card view */}
      <div class="oh-cards">
        {days.value.map(d => (
          <div key={d.dow} class="oh-card" data-dow={String(d.dow)}>
            <div class="oh-card-header">
              <span class="oh-card-day">{d.label}</span>
              <ToggleSwitch
                id={`oh-card-toggle-${d.dow}`}
                checked={d.isClosed}
                label="Closed"
                onChange={(checked) => updateDay(d.dow, { isClosed: checked })}
              />
            </div>
            <div class="oh-card-times" style={d.isClosed ? 'opacity:0.4' : undefined}>
              <div class="oh-card-time-field">
                <label class="oh-card-time-label">Start</label>
                <input
                  type="time"
                  class="oh-card-open-time"
                  step={1800}
                  value={d.openTime}
                  disabled={d.isClosed}
                  onChange={(e) => updateDay(d.dow, { openTime: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div class="oh-card-time-field">
                <label class="oh-card-time-label">End</label>
                <input
                  type="time"
                  class="oh-card-close-time"
                  step={1800}
                  value={d.closeTime}
                  disabled={d.isClosed}
                  onChange={(e) => updateDay(d.dow, { closeTime: (e.target as HTMLInputElement).value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="primary" isLoading={isSaving.value} onClick={handleSave}>
        Save Changes
      </Button>
    </div>
  );
};

export default OpeningHoursSettings;
