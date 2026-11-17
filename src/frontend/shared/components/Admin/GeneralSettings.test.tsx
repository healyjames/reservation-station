// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfig } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import GeneralSettings from './GeneralSettings';

vi.mock('@shared/utils/adminFetch', () => ({ adminFetch: vi.fn() }));

const response = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body }) as Response;

const tenant = {
  name: 'The Red Cow',
  max_guests: 8,
  max_covers: 60,
  concurrent_guests_time_limit: 90,
  booking_delay_minutes: 90,
  contact_email: 'bookings@example.com',
} as TenantConfig;

afterEach(() => {
  vi.resetAllMocks();
});

async function renderLoaded() {
  vi.mocked(adminFetch).mockResolvedValueOnce(response(200, tenant));
  const onSave = vi.fn();
  const utils = render(<GeneralSettings tenantConfig={signal(null)} token="token-123" onSave={onSave} />);
  await utils.findByLabelText('Name');
  return { ...utils, onSave };
}

const value = (el: HTMLElement) => (el as HTMLInputElement).value;

describe('GeneralSettings', () => {
  it('labels every field and fills it from the venue', async () => {
    const { getByLabelText } = await renderLoaded();
    expect(
      [
        'Name',
        'Max party size (per booking)',
        'Max venue capacity',
        'Guest time window (minutes)',
        'Booking delay (hours)',
        'Notification email address',
      ].map((label) => value(getByLabelText(label))),
    ).toEqual(['The Red Cow', '8', '60', '90', '1.5', 'bookings@example.com']);
    expect((getByLabelText('Notification email address') as HTMLInputElement).disabled).toBe(true);
  });

  it('does not repeat the page title, which the layout renders', async () => {
    const { queryByRole } = await renderLoaded();
    expect(queryByRole('heading')).toBeNull();
  });

  it.each([
    ['Guest time window (minutes)', /how long a guest is considered to be present/i],
    ['Booking delay (hours)', /prevents last-minute bookings/i],
  ])('explains %s behind a focusable Info button', async (label, text) => {
    const { getByRole } = await renderLoaded();
    const button = getByRole('button', { name: `More about ${label}` });
    expect(button.tabIndex).toBe(0);
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toMatch(text);
  });

  it('keeps the email warning as a named note', async () => {
    const { getByRole } = await renderLoaded();
    expect(within(getByRole('note', { name: 'About the notification email' })).getByText('Important')).toBeTruthy();
  });

  it('saves the edited settings, converting the delay to minutes, and announces success', async () => {
    const { getByLabelText, getByRole, findByRole, onSave } = await renderLoaded();
    fireEvent.input(getByLabelText('Max venue capacity'), { target: { value: '75' } });
    fireEvent.input(getByLabelText('Booking delay (hours)'), { target: { value: '2' } });
    vi.mocked(adminFetch).mockResolvedValueOnce(response(200));

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Save settings' }));
    });

    const [url, token, init] = vi.mocked(adminFetch).mock.calls[1];
    expect([url, token, init?.method]).toEqual(['/api/admin/me', 'token-123', 'PATCH']);
    expect(JSON.parse(init!.body as string)).toMatchObject({ max_covers: 75, booking_delay_minutes: 120 });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ max_covers: 75 }));
    expect((await findByRole('status')).textContent).toBe('Settings saved.');
  });

  it('disables Save while saving, so it cannot be submitted twice', async () => {
    const { getByRole, findByRole } = await renderLoaded();
    let finish!: (r: Response) => void;
    vi.mocked(adminFetch).mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Save settings' }));
    });
    const save = getByRole('button', { name: 'Save settings' }) as HTMLButtonElement;
    expect([save.disabled, save.getAttribute('aria-busy')]).toEqual([true, 'true']);

    await act(async () => finish(response(200)));
    await findByRole('status');
    expect((getByRole('button', { name: 'Save settings' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('announces a failed save', async () => {
    const { getByRole, findByRole, onSave } = await renderLoaded();
    vi.mocked(adminFetch).mockResolvedValueOnce(response(400, { error: 'Max party size cannot exceed capacity' }));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Save settings' }));
    });
    expect((await findByRole('alert')).textContent).toBe('Max party size cannot exceed capacity');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('announces a failed load', async () => {
    vi.mocked(adminFetch).mockResolvedValueOnce(response(500));
    const { findByRole } = render(<GeneralSettings tenantConfig={signal(null)} token="token-123" onSave={vi.fn()} />);
    expect((await findByRole('alert')).textContent).toBe('Failed to load settings. Please refresh.');
  });
});
