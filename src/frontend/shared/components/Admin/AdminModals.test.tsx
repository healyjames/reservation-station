// @vitest-environment jsdom
import { act, fireEvent, render, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reservation } from '@shared/types';
import { adminFetch } from '@shared/utils/adminFetch';
import { fetchBlockedDatesForMonth } from '@shared/utils/fetchBlockedDatesForMonth';
import BookingModal from './BookingModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import CalendarPickerModal from './CalendarPickerModal';

vi.mock('@shared/utils/adminFetch', () => ({ adminFetch: vi.fn() }));
vi.mock('@shared/utils/fetchBlockedDatesForMonth', () => ({ fetchBlockedDatesForMonth: vi.fn() }));

const response = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body }) as Response;

const reservation: Reservation = {
  id: 'r1',
  tenant_id: 't1',
  first_name: 'Emma',
  surname: 'Wilson',
  telephone: '07700900000',
  email: 'emma@example.com',
  reservation_date: '2099-06-20',
  reservation_time: '19:00',
  guests: 4,
  dietary_requirements: 'No nuts',
};

// Reset implementations too, so a mocked response never carries into the next test.
afterEach(() => {
  vi.resetAllMocks();
});

/** The open dialog, named by its title. Modals render in a portal on document.body. */
const dialog = (name: string) => within(document.body).getByRole('dialog', { name });

describe('BookingModal', () => {
  function renderModal(mode: 'create' | 'edit') {
    const props = { onSuccess: vi.fn(), onClose: vi.fn() };
    render(
      <BookingModal
        mode={mode}
        reservation={mode === 'edit' ? reservation : undefined}
        defaultDate="2099-06-20"
        token="token-123"
        {...props}
      />,
    );
    return props;
  }

  it('labels every field and fills them from the booking when editing', () => {
    renderModal('edit');
    const modal = dialog('Edit Booking');
    const values = ['First name', 'Surname', 'Telephone', 'Email', 'Date', 'Time', 'Guests', 'Dietary requirements'].map(
      (label) => (within(modal).getByLabelText(label) as HTMLInputElement).value,
    );
    expect(values).toEqual(['Emma', 'Wilson', '07700900000', 'emma@example.com', '2099-06-20', '19:00', '4', 'No nuts']);
    expect((within(modal).getByLabelText('First name') as HTMLInputElement).required).toBe(true);
  });

  it('creates a booking from the footer button and closes', async () => {
    vi.mocked(adminFetch).mockResolvedValue(response(201));
    const { onSuccess, onClose } = renderModal('create');
    const modal = dialog('New Booking');
    expect((within(modal).getByLabelText('Date') as HTMLInputElement).value).toBe('2099-06-20');

    fireEvent.input(within(modal).getByLabelText('First name'), { target: { value: 'Ada' } });
    await act(async () => {
      fireEvent.click(within(modal).getByRole('button', { name: 'Create booking' }));
    });

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/reservations', 'token-123', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(vi.mocked(adminFetch).mock.calls[0][2]!.body as string).first_name).toBe('Ada');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('announces a failed save and stays open', async () => {
    vi.mocked(adminFetch).mockResolvedValue(response(422, { error: 'That time is fully booked' }));
    const { onClose } = renderModal('edit');
    await act(async () => {
      fireEvent.click(within(dialog('Edit Booking')).getByRole('button', { name: 'Save changes' }));
    });
    const alert = await within(dialog('Edit Booking')).findByRole('alert');
    expect(alert.textContent).toBe('That time is fully booked');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Esc and on a backdrop click', () => {
    const { onClose } = renderModal('edit');
    fireEvent(dialog('Edit Booking'), new Event('cancel', { cancelable: true }));
    fireEvent.pointerDown(dialog('Edit Booking'));
    fireEvent.click(dialog('Edit Booking'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('DeleteConfirmModal', () => {
  function renderModal() {
    const props = { onSuccess: vi.fn(), onClose: vi.fn() };
    render(<DeleteConfirmModal reservation={reservation} token="token-123" {...props} />);
    return props;
  }

  it('lists the booking it will delete', () => {
    renderModal();
    const modal = dialog('Delete booking');
    expect(Array.from(modal.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      'Name',
      'Date',
      'Time',
      'Guests',
      'Dietary requirements & special requests',
      'Telephone',
      'Email',
    ]);
    expect(within(modal).getByText('Emma Wilson')).toBeTruthy();
  });

  it('deletes and closes', async () => {
    vi.mocked(adminFetch).mockResolvedValue(response(200));
    const { onSuccess, onClose } = renderModal();
    await act(async () => {
      fireEvent.click(within(dialog('Delete booking')).getByRole('button', { name: 'Delete booking' }));
    });
    expect(adminFetch).toHaveBeenCalledWith('/api/admin/reservations/r1', 'token-123', { method: 'DELETE' });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('announces a failed delete', async () => {
    vi.mocked(adminFetch).mockRejectedValue(new Error('offline'));
    renderModal();
    await act(async () => {
      fireEvent.click(within(dialog('Delete booking')).getByRole('button', { name: 'Delete booking' }));
    });
    expect((await within(dialog('Delete booking')).findByRole('alert')).textContent).toBe('Unable to connect. Please try again.');
  });

  it('cancels without deleting', () => {
    const { onClose } = renderModal();
    fireEvent.click(within(dialog('Delete booking')).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

describe('CalendarPickerModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2099, 5, 15, 12));
    vi.mocked(fetchBlockedDatesForMonth).mockResolvedValue({ adminBlocked: ['2099-06-25'], closed: [] } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('goes to the picked day and closes', async () => {
    const onDateSelect = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      render(<CalendarPickerModal open onClose={onClose} currentDate={new Date(2099, 5, 15)} tenantId="t1" onDateSelect={onDateSelect} />);
    });
    const modal = dialog('Go to date');
    expect(within(modal).getByRole('grid', { name: 'June 2099' })).toBeTruthy();

    // The days are disabled until the month's blocked dates have loaded.
    const day = await within(modal).findByRole('button', { name: '20' });
    await act(async () => {
      fireEvent.click(day);
    });
    expect(onDateSelect).toHaveBeenCalledWith(new Date(2099, 5, 20));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('explains a blocked day in a tooltip inside the dialog', async () => {
    await act(async () => {
      render(<CalendarPickerModal open onClose={vi.fn()} currentDate={new Date(2099, 5, 15)} tenantId="t1" onDateSelect={vi.fn()} />);
    });
    const modal = dialog('Go to date');
    await within(modal).findByRole('button', { name: '20' });
    fireEvent.click(within(modal).getByRole('gridcell', { name: '25' }));
    await waitFor(() => expect(within(modal).getByRole('tooltip')).toBeTruthy());
  });

  it('keeps the days disabled until the latest month load settles, ignoring an older one', async () => {
    type Result = Awaited<ReturnType<typeof fetchBlockedDatesForMonth>>;
    const pending: Array<(result: Result) => void> = [];
    vi.mocked(fetchBlockedDatesForMonth).mockImplementation(() => new Promise<Result>((resolve) => pending.push(resolve)));
    const result = (blocked: string[]) => ({ adminBlocked: new Set(blocked), closed: new Set<string>(), aborted: false, error: false });

    await act(async () => {
      render(<CalendarPickerModal open onClose={vi.fn()} currentDate={new Date(2099, 5, 15)} tenantId="t1" onDateSelect={vi.fn()} />);
    });
    const modal = dialog('Go to date');
    expect(pending.length).toBeGreaterThan(1);
    expect(within(modal).getByRole('heading', { level: 3, name: 'June 2099' })).toBeTruthy();

    // The older request finishing first must not enable the days or set its blocked dates.
    await act(async () => pending[0](result(['2099-06-20'])));
    expect(within(modal).queryByRole('button', { name: '21' })).toBeNull();

    await act(async () => pending[pending.length - 1](result(['2099-06-25'])));
    expect(within(modal).getByRole('button', { name: '20' })).toBeTruthy();
    expect(within(modal).getByRole('gridcell', { name: '25' }).dataset.blocked).toBe('true');
  });

  it('closes only the tooltip on the first Esc, leaving the dialog open', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<CalendarPickerModal open onClose={onClose} currentDate={new Date(2099, 5, 15)} tenantId="t1" onDateSelect={vi.fn()} />);
    });
    const modal = dialog('Go to date');
    await within(modal).findByRole('button', { name: '20' });
    fireEvent.click(within(modal).getByRole('gridcell', { name: '25' }));
    await waitFor(() => expect(within(modal).getByRole('tooltip')).toBeTruthy());

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(within(modal).queryByRole('tooltip')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
