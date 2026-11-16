import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { Spinner } from '@shared/components';
import { useAuth } from '@shared/hooks/useAuth';
import { Login, Dashboard, Settings } from '@shared/components/Admin';
import styles from './AdminApp.module.css';

type AdminView = 'login' | 'dashboard' | 'settings';

export const AdminApp: FunctionComponent = () => {
  const auth = useAuth();
  const view = useSignal<AdminView>('login');
  const openSpecificDayHours = useSignal(false);

  useEffect(() => {
    if (auth.isLoading.value) return;
    if (!auth.isAuthed.value) {
      view.value = 'login';
      return;
    }
    const path = window.location.pathname;
    if (path.includes('settings')) {
      view.value = 'settings';
    } else {
      view.value = 'dashboard';
    }
  }, [auth.isAuthed.value, auth.isLoading.value]);

  function onLoginSuccess() {
    view.value = 'dashboard';
  }

  function onLogout() {
    auth.logout();
    view.value = 'login';
  }

  if (auth.isLoading.value) {
    return (
      <div class={styles.loading_screen} aria-busy="true">
        <Spinner size="md" label="Loading…" />
      </div>
    );
  }

  switch (view.value) {
    case 'login':
      return <Login auth={auth} onLoginSuccess={onLoginSuccess} />;
    case 'dashboard':
      return (
        <Dashboard
          auth={auth}
          onLogout={onLogout}
          onGoSettings={() => {
            openSpecificDayHours.value = false;
            view.value = 'settings';
          }}
          onGoSpecificDayHours={() => {
            openSpecificDayHours.value = true;
            view.value = 'settings';
          }}
        />
      );
    case 'settings':
      return (
        <Settings
          auth={auth}
          startOnSpecificDayHours={openSpecificDayHours.value}
          onLogout={onLogout}
          onGoDashboard={() => {
            view.value = 'dashboard';
          }}
        />
      );
    default:
      return null;
  }
};
