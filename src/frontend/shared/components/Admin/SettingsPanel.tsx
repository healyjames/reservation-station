import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import GeneralSettings from './GeneralSettings';
import OpeningHoursSettings from './OpeningHoursSettings';
import BlockedDatesSettings from './BlockedDatesSettings';
import styles from './SettingsPanel.module.css';

type SettingsTab = 'general' | 'opening-hours' | 'blocked-dates';

type SettingsProps = {
  tenantConfig: Signal<TenantConfig | null>;
  token: string;
  onSave: (updated: Partial<TenantConfig>) => void;
  /** Open on Opening Hours > specific-day view instead of the General tab. */
  startOnSpecificDayHours?: boolean;
};

const SettingsPanel: FunctionComponent<SettingsProps> = ({ tenantConfig, token, onSave, startOnSpecificDayHours = false }) => {
  const activeTab = useSignal<SettingsTab>(startOnSpecificDayHours ? 'opening-hours' : 'general');

  return (
    <div class={styles.settings_view}>
      <div class={styles.tab_subnav}>
        <button
          class={`${styles.tab_btn} ${styles.tab_btn_sub}${activeTab.value === 'general' ? ` ${styles.active}` : ''}`}
          data-hash="general"
          onClick={() => {
            activeTab.value = 'general';
          }}
        >
          General
        </button>
        <button
          class={`${styles.tab_btn} ${styles.tab_btn_sub}${activeTab.value === 'opening-hours' ? ` ${styles.active}` : ''}`}
          data-hash="opening-hours"
          onClick={() => {
            activeTab.value = 'opening-hours';
          }}
        >
          Opening Hours
        </button>
        <button
          class={`${styles.tab_btn} ${styles.tab_btn_sub}${activeTab.value === 'blocked-dates' ? ` ${styles.active}` : ''}`}
          data-hash="blocked-dates"
          onClick={() => {
            activeTab.value = 'blocked-dates';
          }}
        >
          Blocked Dates
        </button>
      </div>

      <div id="settings-view" class={styles.settings_panel}>
        {activeTab.value === 'general' && <GeneralSettings tenantConfig={tenantConfig} token={token} onSave={onSave} />}
        {activeTab.value === 'opening-hours' && (
          <OpeningHoursSettings token={token} initialView={startOnSpecificDayHours ? 'specific-day' : 'weekly'} />
        )}
        {activeTab.value === 'blocked-dates' && <BlockedDatesSettings token={token} />}
      </div>
    </div>
  );
};

export default SettingsPanel;
