// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import type { JSX } from 'preact';
import { describe, it, expect, vi } from 'vitest';
import Select from './Select';
import Fieldset from '../Fieldset';

const times = [
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
];

describe('Select', () => {
  it('lists its options', () => {
    const { getByRole } = render(<Select aria-label="Time" options={times} value="18:00" />);
    const select = getByRole('combobox', { name: 'Time' }) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['6:00 PM', '6:30 PM']);
    expect(select.value).toBe('18:00');
  });

  it('selects a disabled, empty placeholder while there is no value', () => {
    const { getByRole } = render(<Select aria-label="Time" options={times} placeholder="Select a time" />);
    const select = getByRole('combobox') as HTMLSelectElement;
    const placeholder = getByRole('option', { name: 'Select a time' }) as HTMLOptionElement;
    expect(select.value).toBe('');
    expect(placeholder.selected).toBe(true);
    expect(placeholder.disabled).toBe(true);
  });

  it('is not submittable while the placeholder is selected and it is required', () => {
    const { getByRole } = render(<Select aria-label="Time" options={times} placeholder="Select a time" required />);
    expect((getByRole('combobox') as HTMLSelectElement).checkValidity()).toBe(false);
  });

  it('falls back to the placeholder when the value is not an option (e.g. a time from another date)', () => {
    const { getByRole } = render(<Select aria-label="Time" options={times} placeholder="Select a time" value="21:00" />);
    expect((getByRole('option', { name: 'Select a time' }) as HTMLOptionElement).selected).toBe(true);
  });

  it('shows the first option when there is no value and no placeholder', () => {
    const { getByRole } = render(<Select aria-label="Time" options={times} />);
    expect((getByRole('combobox') as HTMLSelectElement).value).toBe('18:00');
  });

  it('accepts numeric values', () => {
    const guests = [1, 2, 3].map((n) => ({ value: n, label: String(n) }));
    const { getByRole } = render(<Select aria-label="Guests" options={guests} value={2} />);
    expect((getByRole('combobox') as HTMLSelectElement).value).toBe('2');
  });

  it('calls onChange with the chosen value and passes native attributes through', () => {
    const onChange = vi.fn((event: JSX.TargetedEvent<HTMLSelectElement>) => event.currentTarget.value);
    const { getByRole } = render(
      <Select aria-label="Time" id="mb-time-select" name="time" required options={times} value="18:00" onChange={onChange} />,
    );
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.id).toBe('mb-time-select');
    expect(select.name).toBe('time');
    expect(select.required).toBe(true);
    select.value = '18:30';
    // fireEvent.change is rewritten to an input event once preact/compat is loaded; a select listens to change.
    fireEvent(select, new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveReturnedWith('18:30');
  });

  it('receives the label and error link from ui/Fieldset on the native select', () => {
    const { getByLabelText } = render(
      <Fieldset label="Time" htmlFor="time" error="Pick a time">
        <Select id="time" options={times} placeholder="Select a time" />
      </Fieldset>,
    );
    const select = getByLabelText('Time');
    expect(select.tagName).toBe('SELECT');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(select.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Pick a time');
  });
});
