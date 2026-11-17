// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_ROUTES, ADMIN_ROUTE_TITLES, navigateAdmin, parseAdminRoute, toAdminHash } from './adminRoute';

const at = (hash: string, pathname = '/admin/') => parseAdminRoute({ hash, pathname });

describe('parseAdminRoute', () => {
  it.each(ADMIN_ROUTES)('reads #/%s', (route) => {
    expect(at(`#/${route}`)).toBe(route);
  });

  it('accepts a missing slash after # and a trailing slash', () => {
    expect(at('#settings/general')).toBe('settings/general');
    expect(at('#/settings/blocked-dates/')).toBe('settings/blocked-dates');
  });

  it('opens Bookings for an empty or unknown hash', () => {
    expect(at('')).toBe('bookings');
    expect(at('#')).toBe('bookings');
    expect(at('#/')).toBe('bookings');
    expect(at('#/settings')).toBe('bookings');
    expect(at('#/nope')).toBe('bookings');
  });

  it('opens General settings for the legacy /settings path without a hash', () => {
    expect(at('', '/admin/settings')).toBe('settings/general');
    expect(at('', '/admin/settings/')).toBe('settings/general');
  });

  it('lets the hash win over the legacy /settings path', () => {
    expect(at('#/bookings', '/admin/settings')).toBe('bookings');
  });
});

describe('toAdminHash and navigateAdmin', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('round-trips every route through its hash', () => {
    for (const route of ADMIN_ROUTES) expect(at(toAdminHash(route))).toBe(route);
  });

  it('navigates by setting the hash', () => {
    navigateAdmin('settings/opening-hours/specific-day');
    expect(window.location.hash).toBe('#/settings/opening-hours/specific-day');
  });

  it('titles every route', () => {
    expect(ADMIN_ROUTES.every((route) => ADMIN_ROUTE_TITLES[route].length > 0)).toBe(true);
  });
});
