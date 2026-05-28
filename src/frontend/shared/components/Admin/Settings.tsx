import type { FunctionComponent } from 'preact';
import type { TenantConfig } from '@shared/types';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import SettingsPanel from './SettingsPanel';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import styles from './Settings.module.css';

interface SettingsProps {
  auth: UseAuthReturn;
  onLogout: () => void;
  onGoDashboard: () => void;
}

const Settings: FunctionComponent<SettingsProps> = ({ auth, onLogout, onGoDashboard }) => {
  const venueName = auth.tenantConfig.value?.name ?? 'Settings';
  const token = auth.token.value ?? '';

  function handleSave(updated: Partial<TenantConfig>) {
    if (auth.tenantConfig.value && updated.name) {
      auth.tenantConfig.value = { ...auth.tenantConfig.value, ...updated };
    }
  }

  return (
    <div class={styles.dashboard_layout}>
      <AdminSidebar activePage="settings" onGoBookings={onGoDashboard} onGoSettings={() => {}} />

      <div class={styles.main_panel}>
        <AdminHeader venueName={venueName} onLogout={onLogout} />

        <main id="main-content" class={styles.main_content}>
          <SettingsPanel
            tenantConfig={auth.tenantConfig}
            token={token}
            onSave={handleSave}
          />
        </main>
      </div>
    </div>
  );
};

export default Settings;
