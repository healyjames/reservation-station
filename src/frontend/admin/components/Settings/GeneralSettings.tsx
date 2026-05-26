import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import { Button } from '@shared/components';
import { adminFetch } from '../../utils/api';

interface GeneralSettingsProps {
  tenantConfig: Signal<TenantConfig | null>;
  token: string;
  onSave: (updated: Partial<TenantConfig>) => void;
}

const GeneralSettings: FunctionComponent<GeneralSettingsProps> = ({ tenantConfig, token, onSave }) => {
  const name = useSignal('');
  const maxGuests = useSignal(0);
  const maxCovers = useSignal(0);
  const timeWindow = useSignal(0);
  const isLoading = useSignal(true);
  const isSaving = useSignal(false);
  const errorMessage = useSignal('');
  const successMessage = useSignal('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const r = await adminFetch('/api/admin/me', token);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const tenant = await r.json() as TenantConfig;
      name.value = tenant.name ?? '';
      maxGuests.value = tenant.max_guests ?? 0;
      maxCovers.value = tenant.max_covers ?? 0;
      timeWindow.value = tenant.concurrent_guests_time_limit ?? 0;
    } catch {
      errorMessage.value = 'Failed to load settings. Please refresh.';
    } finally {
      isLoading.value = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isSaving.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    const body = {
      name: name.value.trim(),
      max_guests: maxGuests.value,
      max_covers: maxCovers.value,
      concurrent_guests_time_limit: timeWindow.value,
    };
    try {
      const r = await adminFetch('/api/admin/me', token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      successMessage.value = 'Settings saved.';
      onSave(body);
      setTimeout(() => { successMessage.value = ''; }, 3500);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Failed to save settings.';
    } finally {
      isSaving.value = false;
    }
  }

  if (isLoading.value) {
    return <p class="loading-text">Loading settings…</p>;
  }

  return (
    <div class="settings-panel">
      <h2>Settings</h2>
      {errorMessage.value && (
        <div class="alert alert-error" role="alert" aria-live="assertive">
          {errorMessage.value}
        </div>
      )}
      {successMessage.value && (
        <div class="alert alert-success" role="status" aria-live="polite">
          {successMessage.value}
        </div>
      )}
      <form class="form-container" noValidate onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="sf-name">Name</label>
          <input
            type="text"
            id="sf-name"
            name="name"
            required
            autocomplete="organization"
            value={name.value}
            onInput={(e) => { name.value = (e.target as HTMLInputElement).value; }}
          />
        </div>
        <div class="form-group">
          <label for="sf-max-guests">Max party size</label>
          <input
            type="number"
            id="sf-max-guests"
            name="max_guests"
            min="0"
            value={maxGuests.value}
            onInput={(e) => { maxGuests.value = parseInt((e.target as HTMLInputElement).value, 10) || 0; }}
          />
        </div>
        <div class="form-group">
          <label for="sf-max-covers">Max covers per day</label>
          <input
            type="number"
            id="sf-max-covers"
            name="max_covers"
            min="0"
            value={maxCovers.value}
            onInput={(e) => { maxCovers.value = parseInt((e.target as HTMLInputElement).value, 10) || 0; }}
          />
        </div>
        <div class="form-group">
          <label for="sf-time-window">Concurrent guest time window (minutes)</label>
          <input
            type="number"
            id="sf-time-window"
            name="concurrent_guests_time_limit"
            min="0"
            value={timeWindow.value}
            onInput={(e) => { timeWindow.value = parseInt((e.target as HTMLInputElement).value, 10) || 0; }}
          />
        </div>
        <Button variant="primary" type="submit" isLoading={isSaving.value}>
          Save settings
        </Button>
      </form>
    </div>
  );
};

export default GeneralSettings;
