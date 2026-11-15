// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from '@shared/utils/adminFetch';
import OpeningHoursSettings from './OpeningHoursSettings';

vi.mock('@shared/utils/adminFetch', () => ({
  adminFetch: vi.fn(),
}));

const adminFetchMock = vi.mocked(adminFetch);

function makeResponse<T>(body: T, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('OpeningHoursSettings', () => {
  beforeEach(() => {
    adminFetchMock.mockReset();
    adminFetchMock.mockImplementation(async (url) =>
      url === '/api/admin/opening-hours' ? makeResponse({ success: true, data: [] }) : makeResponse([]),
    );
  });

  it('shows the weekly schedule with a prompt to change hours on a specific day', async () => {
    const { findByRole, getByText } = render(<OpeningHoursSettings token="token-123" />);

    expect(await findByRole('button', { name: /change hours for a specific day/i })).toBeTruthy();
    expect(getByText(/need different hours on a specific day/i)).toBeTruthy();
    expect(getByText('Save Changes')).toBeTruthy();
  });

  it('can open straight on the specific-day view', async () => {
    const { findByRole, queryByText } = render(<OpeningHoursSettings token="token-123" initialView="specific-day" />);

    expect(await findByRole('heading', { name: /change hours on a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).toBeNull();
  });

  it('swaps the weekly schedule for the specific-day view, and back again', async () => {
    const { findByRole, queryByText, getByRole } = render(<OpeningHoursSettings token="token-123" />);

    fireEvent.click(await findByRole('button', { name: /change hours for a specific day/i }));

    expect(await findByRole('heading', { name: /change hours on a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).toBeNull();

    fireEvent.click(getByRole('button', { name: /back to opening hours/i }));

    expect(await findByRole('button', { name: /change hours for a specific day/i })).toBeTruthy();
    expect(queryByText('Save Changes')).not.toBeNull();
  });
});
