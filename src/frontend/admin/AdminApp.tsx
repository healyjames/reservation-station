import type { FunctionComponent } from 'preact';
import type { TenantConfig } from '@shared/types';
import { Loading } from '@shared/components/ui';
import { useAuth } from '@shared/hooks/useAuth';
import { useAdminRoute } from '@shared/hooks/useAdminRoute';
import { navigateAdmin, type AdminRoute } from '@shared/utils/adminRoute';
import { AdminLayout, BlockedDatesSettings, Dashboard, GeneralSettings, Login, OpeningHoursSettings } from '@shared/components/Admin';

/**
 * The admin app. The page comes from the URL hash (`#/bookings`, `#/settings/general`, ...), so refresh keeps it and the
 * browser's back and forward move between pages. A page asked for before signing in opens after sign-in.
 */
export const AdminApp: FunctionComponent = () => {
  const auth = useAuth();
  const route = useAdminRoute();

  if (auth.isLoading.value) {
    return (
      <div class="grid min-h-screen place-items-center">
        <Loading label="Loading…" />
      </div>
    );
  }

  // The hash is left as it is, so signing in opens the page that was asked for.
  if (!auth.isAuthed.value) return <Login auth={auth} onLoginSuccess={() => {}} />;

  const token = auth.token.value ?? '';

  function handleSave(updated: Partial<TenantConfig>) {
    if (auth.tenantConfig.value && updated.name) {
      auth.tenantConfig.value = { ...auth.tenantConfig.value, ...updated };
    }
  }

  function page(current: AdminRoute) {
    switch (current) {
      case 'bookings':
        return <Dashboard auth={auth} />;
      case 'settings/general':
        return <GeneralSettings tenantConfig={auth.tenantConfig} token={token} onSave={handleSave} />;
      case 'settings/opening-hours':
      case 'settings/opening-hours/specific-day':
        return (
          <OpeningHoursSettings
            token={token}
            view={current === 'settings/opening-hours/specific-day' ? 'specific-day' : 'weekly'}
            onViewChange={(view) =>
              navigateAdmin(view === 'specific-day' ? 'settings/opening-hours/specific-day' : 'settings/opening-hours')
            }
          />
        );
      case 'settings/blocked-dates':
        return <BlockedDatesSettings token={token} />;
    }
  }

  return (
    <AdminLayout venueName={auth.tenantConfig.value?.name || 'Admin'} route={route.value} onLogout={auth.logout}>
      {page(route.value)}
    </AdminLayout>
  );
};
