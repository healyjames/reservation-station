// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBlockedDate, AdminDateOverride, Reservation, TenantConfig } from '@shared/types';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import { useBookings, type UseBookingsReturn } from '@shared/hooks/useBookings';
import { useDateOverrides } from '@shared/hooks/useDateOverrides';
import Dashboard from './Dashboard';

vi.mock('@shared/hooks/useBookings');
vi.mock('@shared/hooks/useDateOverrides');

const auth = {
  isAuthed: signal(true),
  isLoading: signal(false),
  showExpiredBanner: signal(false),
  tenantConfig: signal<TenantConfig | null>(null),
  token: signal<string | null>('token-123'),
  login: vi.fn(),
  logout: vi.fn(),
} as UseAuthReturn;

let bookings: UseBookingsReturn;
let loadOverridesMonth: ReturnType<typeof vi.fn<(monthKey: string, force?: boolean) => Promise<void>>>;

function setBookings(overrides: Partial<Record<keyof UseBookingsReturn, unknown>> = {}) {
  bookings = {
    currentDate: signal(new Date(2099, 5, 15)),
    reservations: signal<Reservation[]>([]),
    isLoading: signal(false),
    errorMessage: signal(''),
    guestCount: signal(0),
    isDayBlocked: signal(false),
    isBlockLoading: signal(false),
    dayBlocks: signal<AdminBlockedDate[]>([]),
    blockErrorMessage: signal(''),
    fetchBookings: vi.fn(),
    prevDay: vi.fn(),
    nextDay: vi.fn(),
    deleteBooking: vi.fn(),
    toggleDayBlock: vi.fn(),
    refreshMonth: vi.fn(),
    ...overrides,
  } as UseBookingsReturn;
  vi.mocked(useBookings).mockReturnValue(bookings);
}

beforeEach(() => {
  setBookings();
  loadOverridesMonth = vi.fn<(monthKey: string, force?: boolean) => Promise<void>>().mockResolvedValue(undefined);
  vi.mocked(useDateOverrides).mockReturnValue({
    overridesByDate: signal(new Map<string, AdminDateOverride>()),
    loadMonth: loadOverridesMonth,
  });
});

describe('Dashboard', () => {
  it('blocks the day from a named, described switch', () => {
    const { getByRole } = render(<Dashboard auth={auth} />);
    const toggle = getByRole('checkbox', { name: 'Block this day' });
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent).toMatch(/customers will no longer be able/i);
    fireEvent.click(toggle);
    expect(bookings.toggleDayBlock).toHaveBeenCalledOnce();
  });

  it('refreshes the month and the changed hours', () => {
    const { getByRole } = render(<Dashboard auth={auth} />);
    fireEvent.click(getByRole('button', { name: 'Refresh' }));
    expect(bookings.refreshMonth).toHaveBeenCalledOnce();
    expect(loadOverridesMonth).toHaveBeenCalledWith('2099-06', true);
  });

  it('marks the list busy and disables Refresh while loading', () => {
    setBookings({ isLoading: signal(true) });
    const { getByRole, container, getByText } = render(<Dashboard auth={auth} />);
    expect(container.querySelector('#bookings-list')?.getAttribute('aria-busy')).toBe('true');
    expect(getByText('Loading…')).toBeTruthy();
    expect((getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('says when there are no bookings', () => {
    const { getByText } = render(<Dashboard auth={auth} />);
    expect(getByText('No bookings for this date.')).toBeTruthy();
  });

  it('shows a load error in the list', () => {
    setBookings({ errorMessage: signal('Failed to load bookings') });
    const { getByText, queryByText } = render(<Dashboard auth={auth} />);
    expect(getByText('Failed to load bookings')).toBeTruthy();
    expect(queryByText('No bookings for this date.')).toBeNull();
  });

  it('announces a failed block', () => {
    setBookings({ blockErrorMessage: signal('Could not update the block on this day. Please try again.') });
    const { getByRole } = render(<Dashboard auth={auth} />);
    expect(getByRole('alert').textContent).toMatch('Could not update the block on this day');
  });

  it('shows the changed-hours banner for a day with blocks', () => {
    setBookings({
      dayBlocks: signal<AdminBlockedDate[]>([
        { id: 'b1', tenant_id: 't1', date: '2099-06-15', start_time: '18:00', end_time: '22:00', reason: null } as AdminBlockedDate,
      ]),
    });
    const { getByRole } = render(<Dashboard auth={auth} />);
    expect(getByRole('note', { name: 'Changed hours on this day' })).toBeTruthy();
  });
});
