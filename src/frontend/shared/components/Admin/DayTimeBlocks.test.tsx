// @vitest-environment jsdom
import { render, within, fireEvent, waitFor } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import type { AdminBlockedDate, CalendarDate, OpeningHoursEntry, TimeBlockInput } from '@shared/types';
import { changeSelect } from '@shared/mock/changeSelect';
import DayTimeBlocks from './DayTimeBlocks';

// 2024-01-08 is a Monday (day_of_week 1)
const monday: CalendarDate = { year: 2024, month: 0, day: 8 };

function makeHours(hours: { is_closed?: boolean; open_time?: string | null; close_time?: string | null } = {}): OpeningHoursEntry[] {
  return [
    {
      id: '1',
      tenant_id: 'tenant-1',
      day_of_week: 1,
      is_closed: hours.is_closed ?? false,
      open_time: hours.open_time === undefined ? '18:00' : hours.open_time,
      close_time: hours.close_time === undefined ? '20:00' : hours.close_time,
    },
  ];
}

function makeBlock(overrides: Partial<AdminBlockedDate> = {}): AdminBlockedDate {
  return { id: 'block-1', date: '2024-01-08', start_time: '18:00', end_time: '19:00', reason: null, ...overrides };
}

function renderBlocks({
  openingHours = makeHours(),
  blocks = [],
  isLoading = false,
  errorMessage = '',
  hoursLoaded = true,
  onAdd = vi.fn(async (_input: TimeBlockInput) => true),
  onRemove = vi.fn(),
}: {
  openingHours?: OpeningHoursEntry[] | null;
  hoursLoaded?: boolean;
  blocks?: AdminBlockedDate[];
  isLoading?: boolean;
  errorMessage?: string;
  onAdd?: (input: TimeBlockInput) => Promise<boolean>;
  onRemove?: (id: string) => void;
} = {}) {
  const view = render(
    <DayTimeBlocks
      date={monday}
      openingHours={hoursLoaded ? openingHours : undefined}
      blocks={blocks}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onAdd={onAdd}
      onRemove={onRemove}
    />,
  );
  return { ...view, onAdd, onRemove };
}

function optionValues(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => (option as HTMLOptionElement).value)
    .filter((value) => value !== '');
}

describe('DayTimeBlocks', () => {
  it('lists each block with its time range and reason', () => {
    const { getByRole } = renderBlocks({
      blocks: [makeBlock({ reason: 'Private party' }), makeBlock({ id: 'block-2', start_time: '19:30', end_time: '20:00' })],
    });

    const items = within(getByRole('list', { name: /blocked time ranges/i })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('18:00 – 19:00');
    expect(items[0].textContent).toContain('Private party');
    expect(items[1].textContent).toContain('19:30 – 20:00');
  });

  it('says so when no time ranges are blocked', () => {
    const { getByText, queryByRole } = renderBlocks();
    expect(getByText(/no time ranges are blocked/i)).toBeTruthy();
    expect(queryByRole('list')).toBeNull();
  });

  it('calls onRemove with the id of the block being removed', () => {
    const { getByRole, onRemove } = renderBlocks({
      blocks: [makeBlock(), makeBlock({ id: 'block-2', start_time: '19:30', end_time: '20:00' })],
    });

    fireEvent.click(getByRole('button', { name: 'Remove block 19:30 to 20:00' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('block-2');
  });

  it('offers start times from the opening hours and end times up to and including closing time', () => {
    const { getByLabelText } = renderBlocks();

    expect(optionValues(getByLabelText('From'))).toEqual(['18:00', '18:30', '19:00', '19:30']);
    expect(optionValues(getByLabelText('Until'))).toEqual(['18:30', '19:00', '19:30', '20:00']);
  });

  it('only offers end times after the chosen start, and clears an end that is no longer valid', async () => {
    const { getByLabelText } = renderBlocks();
    const start = getByLabelText('From') as HTMLSelectElement;
    const end = getByLabelText('Until') as HTMLSelectElement;

    changeSelect(start, '18:00');
    await waitFor(() => expect(end.disabled).toBe(false));
    changeSelect(end, '19:00');
    changeSelect(start, '19:00');

    await waitFor(() => expect(optionValues(end)).toEqual(['19:30', '20:00']));
    expect(end.value).toBe('');
  });

  it('keeps the submit button disabled until a start and an end are chosen', async () => {
    const { getByLabelText, getByRole } = renderBlocks();
    const submit = getByRole('button', { name: /block time range/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect((getByLabelText('Until') as HTMLSelectElement).disabled).toBe(true);

    changeSelect(getByLabelText('From') as HTMLSelectElement, '18:00');
    await waitFor(() => expect((getByLabelText('Until') as HTMLSelectElement).disabled).toBe(false));
    expect(submit.disabled).toBe(true);

    changeSelect(getByLabelText('Until') as HTMLSelectElement, '20:00');
    await waitFor(() => expect(submit.disabled).toBe(false));
  });

  it('submits the chosen range and reason, then resets the form', async () => {
    const { getByLabelText, getByRole, onAdd } = renderBlocks();
    const start = getByLabelText('From') as HTMLSelectElement;
    const end = getByLabelText('Until') as HTMLSelectElement;
    const reason = getByLabelText(/reason/i) as HTMLInputElement;

    changeSelect(start, '18:30');
    await waitFor(() => expect(end.disabled).toBe(false));
    changeSelect(end, '20:00');
    fireEvent.input(reason, { target: { value: 'Private party' } });
    await waitFor(() => expect((getByRole('button', { name: /block time range/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(getByRole('button', { name: /block time range/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ start_time: '18:30', end_time: '20:00', reason: 'Private party' }));
    await waitFor(() => expect(start.value).toBe(''));
    expect(reason.value).toBe('');
  });

  it('keeps the entered values when adding fails', async () => {
    const onAdd = vi.fn(async (_input: TimeBlockInput) => false);
    const { getByLabelText, getByRole } = renderBlocks({ onAdd });
    const start = getByLabelText('From') as HTMLSelectElement;
    const end = getByLabelText('Until') as HTMLSelectElement;

    changeSelect(start, '18:30');
    await waitFor(() => expect(end.disabled).toBe(false));
    changeSelect(end, '20:00');
    await waitFor(() => expect((getByRole('button', { name: /block time range/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(getByRole('button', { name: /block time range/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(start.value).toBe('18:30');
    expect(end.value).toBe('20:00');
  });

  it.each([
    ['the day is closed', makeHours({ is_closed: true, open_time: null, close_time: null })],
    ['the opening hours cross midnight', makeHours({ open_time: '22:00', close_time: '02:00' })],
  ])('replaces the form with an explanation when %s, but still lists existing blocks', (_label, openingHours) => {
    const { getByText, queryByLabelText, queryByRole, getByRole } = renderBlocks({ openingHours, blocks: [makeBlock()] });

    expect(getByText(/time ranges can only be blocked on days the venue is open/i)).toBeTruthy();
    expect(queryByLabelText('From')).toBeNull();
    expect(queryByRole('button', { name: /block time range/i })).toBeNull();
    expect(getByRole('button', { name: 'Remove block 18:00 to 19:00' })).toBeTruthy();
  });

  it('uses the default hours when the venue has no opening hours configured', () => {
    const { getByLabelText } = renderBlocks({ openingHours: null });
    const starts = optionValues(getByLabelText('From'));
    expect(starts[0]).toBe('12:00');
    expect(starts[starts.length - 1]).toBe('21:30');
  });

  it('does not offer the form until the opening hours have loaded', () => {
    const { getByText, queryByLabelText } = renderBlocks({ hoursLoaded: false });
    expect(queryByLabelText('From')).toBeNull();
    expect(getByText(/opening hours are not loaded yet/i)).toBeTruthy();
  });

  it('shows an error message as an alert', () => {
    const { getByRole } = renderBlocks({ errorMessage: 'Could not update blocked times. Please try again.' });
    expect(getByRole('alert').textContent).toBe('Could not update blocked times. Please try again.');
  });

  it('disables the remove buttons while a change is being saved', () => {
    const { getByRole } = renderBlocks({ blocks: [makeBlock()], isLoading: true });
    expect((getByRole('button', { name: 'Remove block 18:00 to 19:00' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
