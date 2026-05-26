import type { FunctionComponent } from 'preact';
import type { TenantConfig } from '@shared/types';
import type { UseAuthReturn } from '../hooks/useAuth';
import Settings from '../components/Settings/Settings';

interface SettingsViewProps {
  auth: UseAuthReturn;
  onLogout: () => void;
  onGoDashboard: () => void;
}

const SettingsView: FunctionComponent<SettingsViewProps> = ({ auth, onLogout, onGoDashboard }) => {
  const venueName = auth.tenantConfig.value?.name ?? 'Settings';
  const token = auth.token.value ?? '';

  function handleSave(updated: Partial<TenantConfig>) {
    if (auth.tenantConfig.value && updated.name) {
      auth.tenantConfig.value = { ...auth.tenantConfig.value, ...updated };
    }
  }

  return (
    <div class="dashboard-layout">
      <nav class="sidebar-nav" aria-label="Admin navigation">
        <div class="sidebar-logo" aria-hidden="true" />
        <button class="tab-btn" onClick={onGoDashboard}>
          Bookings
        </button>
        <button class="tab-btn active" aria-current="page">
          Settings
        </button>
      </nav>

      <div class="main-panel">
        <header class="main-header">
          <span id="venue-name" class="header-brand">{venueName}</span>
          <button class="btn-logout" onClick={onLogout}>Sign out</button>
        </header>

        <main id="main-content" class="main-content">
          <Settings
            tenantConfig={auth.tenantConfig}
            token={token}
            onSave={handleSave}
          />
        </main>
      </div>
    </div>
  );
};

export default SettingsView;
