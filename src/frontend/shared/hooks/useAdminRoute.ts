import { useSignal, type Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { parseAdminRoute, type AdminRoute } from '@shared/utils/adminRoute';

/** The current admin page, kept in step with the URL hash (links, `navigateAdmin`, back and forward). */
export function useAdminRoute(): Signal<AdminRoute> {
  const route = useSignal<AdminRoute>(parseAdminRoute(window.location));

  useEffect(() => {
    const onHashChange = () => {
      route.value = parseAdminRoute(window.location);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}
