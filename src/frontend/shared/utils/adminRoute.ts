/** Every admin page, as the path after `#/` in the URL. */
export const ADMIN_ROUTES = [
  'bookings',
  'settings/general',
  'settings/opening-hours',
  'settings/opening-hours/specific-day',
  'settings/blocked-dates',
] as const;

export type AdminRoute = (typeof ADMIN_ROUTES)[number];

/** The page heading for each route. The specific-day view is part of Opening hours. */
export const ADMIN_ROUTE_TITLES: Record<AdminRoute, string> = {
  bookings: 'Bookings',
  'settings/general': 'General settings',
  'settings/opening-hours': 'Opening hours',
  'settings/opening-hours/specific-day': 'Opening hours',
  'settings/blocked-dates': 'Blocked dates',
};

const isAdminRoute = (path: string): path is AdminRoute => (ADMIN_ROUTES as readonly string[]).includes(path);

/**
 * The admin page for a URL. The hash decides (`#/settings/general`). Without a hash, the legacy `/settings` path opens
 * General settings. Anything else opens Bookings.
 */
export function parseAdminRoute({ hash, pathname }: { hash: string; pathname: string }): AdminRoute {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (isAdminRoute(path)) return path;
  if (path === '' && /\/settings\/?$/.test(pathname)) return 'settings/general';
  return 'bookings';
}

export const toAdminHash = (route: AdminRoute): string => `#/${route}`;

/** Opens an admin page by changing the hash, so the browser's back and forward buttons move between pages. */
export function navigateAdmin(route: AdminRoute): void {
  window.location.hash = toAdminHash(route);
}
