import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { Button, FormField, Input } from '@shared/components';
import type { TenantConfig } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import styles from './GeneralSettings.module.css';

type GeneralSettingsProps = {
  tenantConfig: Signal<TenantConfig | null>;
  token: string;
  onSave: (updated: Partial<TenantConfig>) => void;
}

const GeneralSettings: FunctionComponent<GeneralSettingsProps> = ({ tenantConfig, token, onSave }) => {
  const name = useSignal('');
  const maxGuests = useSignal(0);
  const maxCovers = useSignal(0);
  const timeWindow = useSignal(0);
  const contactEmail = useSignal('');
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
      const tenant = (await r.json()) as TenantConfig;
      name.value = tenant.name ?? '';
      maxGuests.value = tenant.max_guests ?? 0;
      maxCovers.value = tenant.max_covers ?? 0;
      timeWindow.value = tenant.concurrent_guests_time_limit ?? 0;
      contactEmail.value = tenant.contact_email ?? '';
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
      contact_email: contactEmail.value.trim(),
    };
    try {
      const r = await adminFetch('/api/admin/me', token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      successMessage.value = 'Settings saved.';
      onSave(body);
      setTimeout(() => {
        successMessage.value = '';
      }, 3500);
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Failed to save settings.';
    } finally {
      isSaving.value = false;
    }
  }

  if (isLoading.value) {
    return <p class={styles.loading_text}>Loading settings…</p>;
  }

  return (
    <div class={styles.settings_panel}>
      <h2>Settings</h2>
      {errorMessage.value && (
        <div class={`${styles.alert} ${styles.alert_error}`} role="alert" aria-live="assertive">
          {errorMessage.value}
        </div>
      )}
      {successMessage.value && (
        <div class={`${styles.alert} ${styles.alert_success}`} role="status" aria-live="polite">
          {successMessage.value}
        </div>
      )}
      <form class={styles.form_container} noValidate onSubmit={handleSubmit}>
        <FormField label="Name" htmlFor="sf-name" required>
          <Input
            type="text"
            id="sf-name"
            name="name"
            required
            autocomplete="organization"
            value={name.value}
            onInput={(e) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
          />
        </FormField>
        <FormField label="Max party size (per booking)" htmlFor="sf-max-guests">
          <Input
            type="number"
            id="sf-max-guests"
            name="max_guests"
            min="0"
            value={maxGuests.value}
            onInput={(e) => {
              maxGuests.value = parseInt((e.target as HTMLInputElement).value, 10) || 0;
            }}
          />
        </FormField>
        <FormField label="Max venue capacity" htmlFor="sf-max-capacity">
          <Input
            type="number"
            id="sf-max-capacity"
            name="max_covers"
            min="0"
            value={maxCovers.value}
            onInput={(e) => {
              maxCovers.value = parseInt((e.target as HTMLInputElement).value, 10) || 0;
            }}
          />
        </FormField>
        <FormField
          label="Guest time window (minutes)"
          htmlFor="sf-time-window"
					tooltip="How long a guest is considered to be present for the purposes of calculating concurrent guests. For example, if set to 60, a guest who books at 6:00pm will be considered present until 7:00pm."
        >
          <Input
            type="number"
            id="sf-time-window"
            name="concurrent_guests_time_limit"
            min="0"
            value={timeWindow.value}
            onInput={(e) => {
              timeWindow.value = parseInt((e.target as HTMLInputElement).value, 10) || 0;
            }}
          />
        </FormField>
        <FormField label="Notification email address" htmlFor="sf-contact-email" required>
          <Input
            type="email"
            id="sf-contact-email"
            name="contact_email"
            autocomplete="email"
            value={contactEmail.value}
            onInput={(e) => {
              contactEmail.value = (e.target as HTMLInputElement).value;
            }}
						disabled
          />
        </FormField>
        <div class={`${styles.alert} ${styles.alert_warning}`} role="note">
          <strong>⚠ Important:</strong> This email address is used for reservation notification emails sent to your guests when they make,
          amend, or cancel a booking. Changing it may affect email delivery. If you need to update this address, please contact support.
        </div>
        <Button variant="primary" type="submit" isLoading={isSaving.value}>
          Save settings
        </Button>
      </form>
    </div>
  );
};

export default GeneralSettings;
