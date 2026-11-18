import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import type { OpeningHoursEntry } from '@shared/types';
import { Alert, Button, Card, Input, Loading, Table, Toggle } from '@shared/components/ui';
import { adminFetch } from '@shared/utils/adminFetch';
import { useMonthTimeBlocks } from '@shared/hooks/useMonthTimeBlocks';
import ChangedHoursList from './ChangedHoursList';
import SpecificDayHours from './SpecificDayHours';

type DayConfig = {
  label: string;
  dow: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

const DAY_ORDER: Array<{ label: string; dow: number }> = [
  { label: 'Monday', dow: 1 },
  { label: 'Tuesday', dow: 2 },
  { label: 'Wednesday', dow: 3 },
  { label: 'Thursday', dow: 4 },
  { label: 'Friday', dow: 5 },
  { label: 'Saturday', dow: 6 },
  { label: 'Sunday', dow: 0 },
];

export type OpeningHoursView = 'weekly' | 'specific-day';

type OpeningHoursSettingsProps = {
  token: string;
  /** The weekly schedule, or the view for changing one specific day. The admin route decides it. */
  view?: OpeningHoursView;
  /** Asks to show the other view; the admin app does this by changing the route. */
  onViewChange: (view: OpeningHoursView) => void;
};

const OpeningHoursSettings: FunctionComponent<OpeningHoursSettingsProps> = ({ token, view = 'weekly', onViewChange }) => {
  const days = useSignal<DayConfig[]>(
    DAY_ORDER.map(({ label, dow }) => ({
      label,
      dow,
      isClosed: false,
      openTime: '12:00',
      closeTime: '22:00',
    })),
  );
  const isLoading = useSignal(true);
  const isSaving = useSignal(false);
  const bannerMessage = useSignal('');
  const bannerType = useSignal<'success' | 'error'>('success');

  const changedHours = useMonthTimeBlocks(token);

  function loadChangedHours() {
    const now = new Date();
    void changedHours.loadMonth(now.getFullYear(), now.getMonth());
  }

  useEffect(() => {
    loadHours();
  }, []);

  // Also when coming back from the specific-day view, where ranges may have been added or removed.
  useEffect(() => {
    if (view === 'weekly') loadChangedHours();
  }, [view]);

  async function loadHours() {
    isLoading.value = true;
    try {
      const r = await adminFetch('/api/admin/opening-hours', token);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as { data?: OpeningHoursEntry[] };
      const data: OpeningHoursEntry[] = json.data && json.data.length > 0 ? json.data : [];
      days.value = DAY_ORDER.map(({ label, dow }) => {
        const entry = data.find((e) => e.day_of_week === dow);
        const isClosed = entry ? !!entry.is_closed : false;
        const openTime = entry && !entry.is_closed && entry.open_time ? entry.open_time : '12:00';
        const closeTime = entry && !entry.is_closed && entry.close_time ? entry.close_time : '22:00';
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
    setTimeout(() => {
      bannerMessage.value = '';
    }, 3500);
  }

  function updateDay(dow: number, patch: Partial<DayConfig>) {
    days.value = days.value.map((d) => (d.dow === dow ? { ...d, ...patch } : d));
  }

  async function handleSave() {
    isSaving.value = true;
    const body = days.value.map((d) => ({
      day_of_week: d.dow,
      is_closed: d.isClosed,
      open_time: d.isClosed ? null : d.openTime,
      close_time: d.isClosed ? null : d.closeTime,
    }));
    try {
      const r = await adminFetch('/api/admin/opening-hours', token, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      showBanner('success', 'Opening hours saved.');
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'Failed to save opening hours.');
    } finally {
      isSaving.value = false;
    }
  }

  if (view === 'specific-day') {
    return <SpecificDayHours token={token} onBack={() => onViewChange('weekly')} />;
  }

  if (isLoading.value) {
    return (
      <p class="text-base-content/70 flex items-center gap-3">
        <Loading size="sm" label={null} />
        Loading opening hours…
      </p>
    );
  }

  // Both layouts stay in the DOM (CSS shows one), so every control is named with its day.
  const closedLabel = (day: string) => (
    <>
      Closed <span class="sr-only">on {day}</span>
    </>
  );

  // The page title comes from AdminLayout's h1.
  return (
    <div class="grid gap-6">
      {bannerMessage.value &&
        (bannerType.value === 'success' ? (
          <Alert variant="success" live="polite">
            {bannerMessage.value}
          </Alert>
        ) : (
          <Alert variant="error" live="assertive">
            {bannerMessage.value}
          </Alert>
        ))}

      <Table class="hidden md:block" caption="Weekly opening hours" hideCaption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
            <th scope="col">Closed</th>
          </tr>
        </thead>
        <tbody>
          {days.value.map((d) => (
            <tr key={d.dow} data-dow={String(d.dow)}>
              <th scope="row" class="font-medium">
                {d.label}
              </th>
              <td>
                <Input
                  type="time"
                  class="max-w-36"
                  step={1800}
                  aria-label={`${d.label} start time`}
                  value={d.openTime}
                  disabled={d.isClosed}
                  onInput={(e) => updateDay(d.dow, { openTime: (e.target as HTMLInputElement).value })}
                />
              </td>
              <td>
                <Input
                  type="time"
                  class="max-w-36"
                  step={1800}
                  aria-label={`${d.label} end time`}
                  value={d.closeTime}
                  disabled={d.isClosed}
                  onInput={(e) => updateDay(d.dow, { closeTime: (e.target as HTMLInputElement).value })}
                />
              </td>
              <td>
                {/* The column header shows "Closed"; the name still says the day. */}
                <Toggle
                  id={`oh-toggle-${d.dow}`}
                  hideLabel
                  checked={d.isClosed}
                  label={closedLabel(d.label)}
                  onChange={(checked) => updateDay(d.dow, { isClosed: checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div class="grid gap-3 md:hidden">
        {days.value.map((d) => (
          <Card key={d.dow} class="bg-base-200 [--card-p:1rem]" data-dow={String(d.dow)}>
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold">{d.label}</span>
              <Toggle
                id={`oh-card-toggle-${d.dow}`}
                checked={d.isClosed}
                label={closedLabel(d.label)}
                onChange={(checked) => updateDay(d.dow, { isClosed: checked })}
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="grid gap-1">
                <label htmlFor={`oh-card-open-${d.dow}`} class="text-xs font-semibold uppercase">
                  {/* Shown as START; read as "Monday start time". */}
                  <span class="sr-only">{d.label}</span> start <span class="sr-only">time</span>
                </label>
                <Input
                  type="time"
                  id={`oh-card-open-${d.dow}`}
                  step={1800}
                  value={d.openTime}
                  disabled={d.isClosed}
                  onInput={(e) => updateDay(d.dow, { openTime: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div class="grid gap-1">
                <label htmlFor={`oh-card-close-${d.dow}`} class="text-xs font-semibold uppercase">
                  <span class="sr-only">{d.label}</span> end <span class="sr-only">time</span>
                </label>
                <Input
                  type="time"
                  id={`oh-card-close-${d.dow}`}
                  step={1800}
                  value={d.closeTime}
                  disabled={d.isClosed}
                  onInput={(e) => updateDay(d.dow, { closeTime: (e.target as HTMLInputElement).value })}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="primary" class="justify-self-start" isLoading={isSaving.value} onClick={handleSave}>
        Save Changes
      </Button>

      <Card
        as="section"
        aria-labelledby="oh-specific-day-heading"
        class="bg-base-200 [--card-p:1rem]"
        title={<span id="oh-specific-day-heading">Need different hours on a specific day?</span>}
        titleAs="h2"
        actions={<Button onClick={() => onViewChange('specific-day')}>Change hours for a specific day</Button>}
      >
        <p class="text-base-content/70 m-0 text-sm">
          Close early on Christmas Eve, open for lunch only on Boxing Day, or open on a day you are normally closed, without changing your
          weekly opening hours.
        </p>
      </Card>

      <ChangedHoursList
        year={changedHours.viewYear.value}
        month={changedHours.viewMonth.value}
        blocks={changedHours.monthBlocks.value}
        overrides={changedHours.monthOverrides.value}
        isSaving={changedHours.isSaving.value}
        errorMessage={changedHours.saveError.value || changedHours.loadError.value}
        onRemove={(id) => void changedHours.removeBlock(id)}
        onRemoveOverride={(date) => void changedHours.removeSpecialHours(date)}
      />
    </div>
  );
};

export default OpeningHoursSettings;
