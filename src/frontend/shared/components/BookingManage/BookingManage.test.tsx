// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarDate, EditData, Reservation, TenantConfig } from '@shared/types';
import { changeSelect } from '@shared/mock/changeSelect';
import { CancelConfirm, ChangeDateTime, EditDetails, Error as ErrorView, Loading, Overview, SuccessCancel, SuccessEdit } from '.';

const reservation: Reservation = {
  id: 'r1',
  tenant_id: 't1',
  first_name: 'Alex',
  surname: 'Guest',
  telephone: '01234567890',
  email: 'alex@example.com',
  reservation_date: '2099-06-20',
  reservation_time: '19:00',
  guests: 2,
  dietary_requirements: 'No nuts',
};

const tenant = {
  id: 't1',
  name: 'Test Venue',
  tenant_code: 'test-venue',
  max_guests: 6,
  max_covers: 40,
  status: 'active',
  concurrent_guests_time_limit: 120,
  booking_delay_minutes: 0,
  opening_hours: [],
} as TenantConfig;

const terms = (container: Element) => Array.from(container.querySelectorAll('dt')).map((dt) => dt.textContent);

describe('manage booking views', () => {
  it('Loading names the page and announces loading', () => {
    const { getByRole } = render(<Loading />);
    expect(getByRole('heading', { level: 1, name: 'Manage your booking' })).toBeTruthy();
    expect(getByRole('status').textContent).toBe('Loading your booking details');
  });

  it('Error shows the message under its own heading', () => {
    const { getByRole, getByText } = render(<ErrorView message="Link expired" />);
    expect(getByRole('heading', { level: 2, name: 'Unable to load booking' })).toBeTruthy();
    expect(getByText('Link expired')).toBeTruthy();
  });

  describe('Overview', () => {
    function renderOverview(errorMessage = '') {
      const actions = { goToEditDetails: vi.fn(), goToChangeDatetime: vi.fn().mockResolvedValue(undefined), goToCancelConfirm: vi.fn() };
      const view = render(<Overview reservation={signal(reservation)} errorMessage={signal(errorMessage)} {...actions} />);
      return { ...view, ...actions };
    }

    it('lists the booking details in order, including dietary requirements', () => {
      const { container, getByText } = renderOverview();
      expect(terms(container)).toEqual(['Name', 'Date', 'Time', 'Party size', 'Dietary requirements & special requests']);
      expect(getByText('Alex Guest')).toBeTruthy();
      expect(getByText('2 guests')).toBeTruthy();
    });

    it('offers edit, change date and cancel, in that order', () => {
      const { getAllByRole, goToEditDetails, goToChangeDatetime, goToCancelConfirm } = renderOverview();
      const buttons = getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Edit Details', 'Change Date & Time', 'Cancel Booking']);
      buttons.forEach((b) => fireEvent.click(b));
      expect(goToEditDetails).toHaveBeenCalledOnce();
      expect(goToChangeDatetime).toHaveBeenCalledOnce();
      expect(goToCancelConfirm).toHaveBeenCalledOnce();
    });

    it('announces an action error', () => {
      const { getByRole } = renderOverview('Could not load times');
      expect(getByRole('alert').textContent).toMatch(/something went wrong.*could not load times/i);
    });

    it('shows no error alert without a message', () => {
      const { queryByRole } = renderOverview();
      expect(queryByRole('alert')).toBeNull();
    });
  });

  describe('CancelConfirm', () => {
    it('keeps or cancels the booking, and is busy while cancelling', async () => {
      let finish: () => void = () => {};
      const confirmCancel = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      const goToOverview = vi.fn();
      const { getByRole } = render(
        <CancelConfirm
          reservation={signal(reservation)}
          errorMessage={signal('')}
          goToOverview={goToOverview}
          confirmCancel={confirmCancel}
        />,
      );
      expect(getByRole('heading', { level: 1, name: 'Cancel Booking' })).toBeTruthy();

      fireEvent.click(getByRole('button', { name: 'Keep My Booking' }));
      expect(goToOverview).toHaveBeenCalledOnce();

      fireEvent.click(getByRole('button', { name: 'Cancel My Booking' }));
      expect(confirmCancel).toHaveBeenCalledOnce();
      const busy = getByRole('button', { name: 'Cancelling...' }) as HTMLButtonElement;
      expect(busy.disabled).toBe(true);
      await act(async () => finish());
      expect(getByRole('button', { name: 'Cancel My Booking' })).toBeTruthy();
    });
  });

  describe('EditDetails', () => {
    const editData: EditData = {
      first_name: 'Alex',
      surname: 'Guest',
      telephone: '01234567890',
      email: 'alex@example.com',
      dietary_requirements: '',
      guests: 2,
    };

    function renderEdit() {
      const saveEditDetails = vi.fn().mockResolvedValue(undefined);
      const goToOverview = vi.fn();
      const view = render(
        <EditDetails
          editData={signal(editData)}
          tenantConfig={signal(tenant)}
          errorMessage={signal('')}
          goToOverview={goToOverview}
          saveEditDetails={saveEditDetails}
        />,
      );
      return { ...view, saveEditDetails, goToOverview };
    }

    it('labels every field and requires the contact details', () => {
      const { getByLabelText } = renderEdit();
      for (const label of ['First Name', 'Surname', 'Phone Number', 'Email']) {
        expect((getByLabelText(label) as HTMLInputElement).required).toBe(true);
      }
      expect(getByLabelText(/dietary requirements/i)).toBeTruthy();
      const guests = getByLabelText('Number of Guests') as HTMLSelectElement;
      expect(guests.value).toBe('2');
      expect(Array.from(guests.options).map((o) => o.value)).toEqual(['2', '3', '4', '5', '6']);
    });

    it('saves the trimmed values', async () => {
      const { getByLabelText, getByRole, saveEditDetails } = renderEdit();
      fireEvent.input(getByLabelText('Surname'), { target: { value: '  Smith ' } });
      await act(async () => {
        changeSelect(getByLabelText('Number of Guests') as HTMLSelectElement, '4');
      });
      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Save Changes' }));
      });
      expect(saveEditDetails).toHaveBeenCalledWith({ ...editData, surname: 'Smith', guests: 4 });
    });

    it('goes back without saving', () => {
      const { getByRole, goToOverview, saveEditDetails } = renderEdit();
      fireEvent.click(getByRole('button', { name: 'Back' }));
      expect(goToOverview).toHaveBeenCalledOnce();
      expect(saveEditDetails).not.toHaveBeenCalled();
    });
  });

  describe('ChangeDateTime', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      vi.setSystemTime(new Date(2099, 5, 15, 12));
    });
    afterEach(() => vi.useRealTimers());

    function renderChange(
      overrides: { selectedDate?: CalendarDate | null; blocked?: string[]; isFetchingTimes?: boolean; daySlots?: string[] | null } = {},
    ) {
      const calYear = signal(2099);
      const calMonth = signal(5);
      const props = {
        tenantConfig: signal<TenantConfig | null>(tenant),
        errorMessage: signal(''),
        calYear,
        calMonth,
        selectedDate: signal<CalendarDate | null>(overrides.selectedDate ?? null),
        selectedTime: signal(''),
        blockedDates: signal(new Set(overrides.blocked ?? [])),
        closedDates: signal(new Set<string>()),
        blockedTimes: signal<string[]>([]),
        daySlots: signal<string[] | null>(overrides.daySlots ?? null),
        isFetchingTimes: signal(overrides.isFetchingTimes ?? false),
        goToOverview: vi.fn(),
        saveDatetime: vi.fn().mockResolvedValue(undefined),
        fetchBlockedDatesForMonth: vi.fn().mockResolvedValue(undefined),
        selectDate: vi.fn().mockResolvedValue(undefined),
      };
      return { ...render(<ChangeDateTime {...props} />), ...props };
    }

    it('moves between months with the named month buttons, not before the current month', async () => {
      const { getByRole, fetchBlockedDatesForMonth } = renderChange();
      const picker = getByRole('region', { name: 'Date picker' });
      expect(within(picker).getByRole('heading', { level: 2, name: 'June 2099' })).toBeTruthy();
      expect((getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true);

      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Next month' }));
      });
      expect(fetchBlockedDatesForMonth).toHaveBeenCalledWith(2099, 6);
      expect(within(picker).getByRole('heading', { level: 2, name: 'July 2099' })).toBeTruthy();
    });

    it('selects an available day', () => {
      const { getByRole, selectDate } = renderChange();
      fireEvent.click(getByRole('button', { name: '25' }));
      expect(selectDate).toHaveBeenCalledWith(2099, 5, 25);
    });

    it('explains a tapped blocked day, and closes the tip on a month change', async () => {
      const { getByRole, queryByRole } = renderChange({ blocked: ['2099-06-20'] });
      fireEvent.click(getByRole('gridcell', { name: '20' }));
      expect(getByRole('tooltip').textContent).toMatch('Bookings currently unavailable for this date');
      const status = within(getByRole('region', { name: 'Date picker' })).getByRole('status');
      expect(status.textContent).toBe('Bookings currently unavailable for this date');

      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Next month' }));
      });
      expect(queryByRole('tooltip')).toBeNull();
      expect(status.textContent).toBe('');
    });

    it('hides the tip and clears the status after 3 seconds', () => {
      const { getByRole, queryByRole } = renderChange({ blocked: ['2099-06-20'] });
      fireEvent.click(getByRole('gridcell', { name: '20' }));
      const status = within(getByRole('region', { name: 'Date picker' })).getByRole('status');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(queryByRole('tooltip')).toBeNull();
      expect(status.textContent).toBe('');
    });

    it('has no time picker until a date is chosen', () => {
      const { queryByLabelText, queryByText } = renderChange();
      expect(queryByLabelText('Time')).toBeNull();
      expect(queryByText(/^Time$/)).toBeNull();
    });

    it("offers the chosen date's server slots and saves once a time is picked", async () => {
      const { getByLabelText, getByRole, selectedTime, saveDatetime } = renderChange({
        selectedDate: { year: 2099, month: 5, day: 20 },
        daySlots: ['18:00', '18:30'],
      });
      const time = getByLabelText('Time') as HTMLSelectElement;
      expect(Array.from(time.options).map((o) => o.value)).toEqual(['', '18:00', '18:30']);
      const save = getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      await act(async () => {
        changeSelect(time, '18:30');
      });
      expect(selectedTime.value).toBe('18:30');
      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Save Changes' }));
      });
      expect(saveDatetime).toHaveBeenCalledOnce();
    });

    it('keeps the Time caption while times load, and when there are none', () => {
      const loading = renderChange({ selectedDate: { year: 2099, month: 5, day: 20 }, isFetchingTimes: true });
      expect(loading.getByText('Time')).toBeTruthy();
      expect(loading.getAllByRole('status').some((s) => s.textContent === 'Loading available times')).toBe(true);
      loading.unmount();

      const none = renderChange({ selectedDate: { year: 2099, month: 5, day: 20 }, daySlots: [] });
      expect(none.getByText('Time')).toBeTruthy();
      expect(none.getByText(/no times available for this date/i)).toBeTruthy();
    });

    it('goes back from the Back button', () => {
      const { getByRole, goToOverview } = renderChange();
      fireEvent.click(getByRole('button', { name: 'Back' }));
      expect(goToOverview).toHaveBeenCalledOnce();
    });
  });

  it('SuccessEdit confirms the update and goes back to the details', () => {
    const onBack = vi.fn();
    const { getByRole, getByText } = render(<SuccessEdit reservation={reservation} onBack={onBack} />);
    expect(getByRole('heading', { level: 2, name: 'Booking updated.' })).toBeTruthy();
    expect(getByText('Alex Guest')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Back to booking details' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('SuccessCancel confirms the cancellation with no further actions', () => {
    const { getByRole, queryByRole } = render(<SuccessCancel reservation={reservation} />);
    expect(getByRole('heading', { level: 2, name: 'Your booking has been cancelled.' })).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});
