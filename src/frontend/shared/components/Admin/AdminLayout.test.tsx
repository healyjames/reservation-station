// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminRoute } from '@shared/utils/adminRoute';
import { ADMIN_MODE_STORAGE_KEY } from '@shared/utils/adminThemePreference';
import AdminLayout from './AdminLayout';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.title = '';
});

/** Sets whether the viewport is lg or wider, where the drawer is docked. */
const stubDocked = (docked: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: docked,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

const runAnimationFramesNow = () =>
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });

function renderLayout(route: AdminRoute = 'bookings') {
  const onLogout = vi.fn();
  const view = render(
    <AdminLayout venueName="The Red Cow" route={route} onLogout={onLogout}>
      <p>Page content</p>
    </AdminLayout>,
  );
  return { ...view, onLogout };
}

describe('AdminLayout', () => {
  it('shows the venue, the page title as the h1, and the page in #main-content', () => {
    const { getByRole, getByText, container } = renderLayout('settings/blocked-dates');
    expect(getByRole('heading', { level: 1, name: 'Blocked dates' })).toBeTruthy();
    expect(container.querySelector('#venue-name')?.textContent).toBe('The Red Cow');
    expect(getByRole('main').id).toBe('main-content');
    expect(within(getByRole('main')).getByText('Page content')).toBeTruthy();
    expect(getByText('Page content')).toBeTruthy();
    expect(document.title).toBe('Blocked dates - Maximum Bookings Admin');
  });

  it('links every page by its hash', () => {
    const { getByRole } = renderLayout();
    const nav = getByRole('navigation', { name: 'Admin' });
    const links = {
      Bookings: '#/bookings',
      'General settings': '#/settings/general',
      'Opening hours': '#/settings/opening-hours',
      'Blocked dates': '#/settings/blocked-dates',
    };
    for (const [name, href] of Object.entries(links)) {
      expect(within(nav).getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
  });

  it.each([
    ['bookings', 'Bookings'],
    ['settings/general', 'General settings'],
    ['settings/opening-hours', 'Opening hours'],
    ['settings/opening-hours/specific-day', 'Opening hours'],
    ['settings/blocked-dates', 'Blocked dates'],
  ] as const)('marks only the current page on %s', (route, current) => {
    const { getAllByRole } = renderLayout(route);
    const marked = getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(marked.map((link) => link.textContent)).toEqual([current]);
  });

  it('toggles the drawer, reporting it with aria-expanded and aria-controls', () => {
    const { getByRole } = renderLayout();
    const toggle = getByRole('button', { name: 'Navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the overlay drawer and focuses the page when a link is followed below lg', () => {
    stubDocked(false);
    runAnimationFramesNow();
    const { getByRole } = renderLayout();
    const toggle = getByRole('button', { name: 'Navigation' });
    fireEvent.click(toggle);

    act(() => {
      fireEvent.click(getByRole('link', { name: 'General settings' }));
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(getByRole('main'));
  });

  it('keeps the docked drawer as it is when a link is followed from lg up', () => {
    stubDocked(true);
    runAnimationFramesNow();
    const { getByRole } = renderLayout();
    const toggle = getByRole('button', { name: 'Navigation' });
    fireEvent.click(toggle);
    const link = getByRole('link', { name: 'General settings' });
    link.focus();

    act(() => {
      fireEvent.click(link);
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(link);
  });

  it('puts the page title back when it unmounts (sign-out shows sign-in)', () => {
    const { unmount } = renderLayout('settings/general');
    expect(document.title).toBe('General settings - Maximum Bookings Admin');
    unmount();
    expect(document.title).toBe('Maximum Bookings Admin');
  });

  it('signs out from the Sign out button', () => {
    const { getByRole, onLogout } = renderLayout();
    fireEvent.click(getByRole('button', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('switches between the admin themes and saves the mode', () => {
    document.documentElement.setAttribute('data-theme', 'admin-dark');
    const { getByRole } = renderLayout();
    const toggle = getByRole('checkbox', { name: 'Dark mode' }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('admin-light');
    expect(window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('light');

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('admin-dark');
    expect(window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('dark');
  });
});
