import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import GeneralSettings from './GeneralSettings';
import OpeningHoursSettings from './OpeningHoursSettings';
import BlockedDatesSettings from './BlockedDatesSettings';

type SettingsTab = 'general' | 'opening-hours' | 'blocked-dates';

interface SettingsProps {
  tenantConfig: Signal<TenantConfig | null>;
  token: string;
  onSave: (updated: Partial<TenantConfig>) => void;
}

const Settings: FunctionComponent<SettingsProps> = ({ tenantConfig, token, onSave }) => {
  const activeTab = useSignal<SettingsTab>('general');

  return (
    <div class="settings-view">
      <div class="tab-subnav">
        <button
          class={`tab-btn tab-btn--sub${activeTab.value === 'general' ? ' active' : ''}`}
          data-hash="general"
          onClick={() => { activeTab.value = 'general'; }}
        >
          General
        </button>
        <button
          class={`tab-btn tab-btn--sub${activeTab.value === 'opening-hours' ? ' active' : ''}`}
          data-hash="opening-hours"
          onClick={() => { activeTab.value = 'opening-hours'; }}
        >
          Opening Hours
        </button>
        <button
          class={`tab-btn tab-btn--sub${activeTab.value === 'blocked-dates' ? ' active' : ''}`}
          data-hash="blocked-dates"
          onClick={() => { activeTab.value = 'blocked-dates'; }}
        >
          Blocked Dates
        </button>
      </div>

      <div id="settings-view" class="settings-panel">
        {activeTab.value === 'general' && (
          <GeneralSettings tenantConfig={tenantConfig} token={token} onSave={onSave} />
        )}
        {activeTab.value === 'opening-hours' && (
          <OpeningHoursSettings token={token} />
        )}
        {activeTab.value === 'blocked-dates' && (
          <BlockedDatesSettings token={token} />
        )}
      </div>
    </div>
  );
};

export default Settings;
