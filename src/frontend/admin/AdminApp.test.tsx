// @vitest-environment jsdom
import { act, fireEvent, render, waitFor } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfig } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { useAuth, type UseAuthReturn } from '@shared/hooks/useAuth';
import { AdminApp } from './AdminApp';

vi.mock('@shared/hooks/useAuth');
vi.mock('@shared/utils/adminFetch', () => ({ adminFetch: vi.fn() }));

const tenant = {
  id: 't1',
  name: 'The Red Cow',
  tenant_code: 'the-red-cow',
  max_guests: 6,
  max_covers: 40,
  status: 'active',
  concurrent_guests_time_limit: 120,
  booking_delay_minutes: 0,
  contact_email: 'hello@example.com',
  opening_hours: [],
} as TenantConfig;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

let auth: UseAuthReturn;

function signIn(authed: boolean) {
  auth = {
    isAuthed: signal(authed),
    isLoading: signal(false),
    showExpiredBanner: signal(false),
    tenantConfig: signal<TenantConfig | null>(authed ? tenant : null),
    token: signal<string | null>(authed ? 'token-123' : null),
    login: vi.fn(),
    logout: vi.fn(),
  };
  vi.mocked(useAuth).mockReturnValue(auth);
}

const goTo = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

beforeEach(() => {
  vi.mocked(adminFetch).mockImplementation(async (url) => {
    if (url === '/api/admin/me') return ok(tenant);
    if (url === '/api/admin/opening-hours') return ok({ success: true, data: [] });
    return ok([]);
  });
});

afterEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
  document.title = '';
});

describe('AdminApp', () => {
  it('shows sign-in when signed out, keeping the requested page in the URL', () => {
    window.location.hash = '#/settings/general';
    signIn(false);
    const { getByRole, queryByRole } = render(<AdminApp />);
    expect(getByRole('heading', { name: 'Staff Sign In' })).toBeTruthy();
    expect(queryByRole('navigation', { name: 'Admin' })).toBeNull();
    expect(window.location.hash).toBe('#/settings/general');
  });

  it('opens the page in the URL once signed in', () => {
    window.location.hash = '#/settings/blocked-dates';
    signIn(true);
    const { getByRole } = render(<AdminApp />);
    expect(getByRole('heading', { level: 1, name: 'Blocked dates' })).toBeTruthy();
    expect(getByRole('link', { name: 'Blocked dates' }).getAttribute('aria-current')).toBe('page');
  });

  it('swaps the page when the hash changes', () => {
    signIn(true);
    const { getByRole } = render(<AdminApp />);
    expect(getByRole('heading', { level: 1, name: 'Bookings' })).toBeTruthy();

    goTo('#/settings/opening-hours');
    expect(getByRole('heading', { level: 1, name: 'Opening hours' })).toBeTruthy();
  });

  it('routes the Opening hours specific-day button through the URL', async () => {
    window.location.hash = '#/settings/opening-hours';
    signIn(true);
    const { findByRole } = render(<AdminApp />);
    fireEvent.click(await findByRole('button', { name: /change hours for a specific day/i }));
    expect(window.location.hash).toBe('#/settings/opening-hours/specific-day');
  });

  it('shows a saved venue name in the header', async () => {
    window.location.hash = '#/settings/general';
    signIn(true);
    const { container, findByLabelText, getByRole } = render(<AdminApp />);
    const name = (await findByLabelText(/^Name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('The Red Cow'));

    fireEvent.input(name, { target: { value: 'The Blue Cow' } });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Save settings' }));
    });

    await waitFor(() => expect(container.querySelector('#venue-name')?.textContent).toBe('The Blue Cow'));
  });

  it('signs out from the drawer', () => {
    signIn(true);
    const { getByRole } = render(<AdminApp />);
    fireEvent.click(getByRole('button', { name: 'Sign out' }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
