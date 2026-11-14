// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Input from './Input';
import Fieldset from '../Fieldset';

describe('Input', () => {
  it('is a text box by default', () => {
    const { getByRole } = render(<Input aria-label="Name" />);
    expect(getByRole('textbox', { name: 'Name' }).getAttribute('type')).toBe('text');
  });

  it('passes native attributes through', () => {
    const { getByRole } = render(
      <Input
        type="tel"
        id="telephone"
        name="telephone"
        aria-label="Phone number"
        pattern="\+?[\d\s\-]{7,15}"
        title="7 to 15 digits"
        required
        autocomplete="tel"
        maxLength={15}
      />,
    );
    const input = getByRole('textbox', { name: 'Phone number' }) as HTMLInputElement;
    expect(input.type).toBe('tel');
    expect(input.id).toBe('telephone');
    expect(input.name).toBe('telephone');
    expect(input.pattern).toBe('\\+?[\\d\\s\\-]{7,15}');
    expect(input.title).toBe('7 to 15 digits');
    expect(input.required).toBe(true);
    expect(input.getAttribute('autocomplete')).toBe('tel');
    expect(input.maxLength).toBe(15);
  });

  it('supports number inputs with min and step', () => {
    const { getByRole } = render(<Input type="number" aria-label="Booking delay" min="0" step="0.5" />);
    const input = getByRole('spinbutton', { name: 'Booking delay' }) as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.step).toBe('0.5');
  });

  it('calls onInput when the user types', () => {
    const onInput = vi.fn();
    const { getByRole } = render(<Input aria-label="Name" value="" onInput={onInput} />);
    const input = getByRole('textbox') as HTMLInputElement;
    input.value = 'Ada';
    fireEvent.input(input);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('fires onChange on each keystroke, because preact/compat maps it to input', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Input aria-label="Guests" type="number" onChange={onChange} />);
    fireEvent.input(getByRole('spinbutton'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('reports aria-invalid when given it', () => {
    const { getByRole } = render(<Input aria-label="Email" aria-invalid="true" />);
    expect(getByRole('textbox', { name: 'Email' }).getAttribute('aria-invalid')).toBe('true');
  });

  it('receives the label and error link from ui/Fieldset on the native input', () => {
    const { getByLabelText } = render(
      <Fieldset label="Email" htmlFor="email" error="Enter a valid email">
        <Input id="email" type="email" />
      </Fieldset>,
    );
    const input = getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(errorId)?.textContent).toBe('Enter a valid email');
  });
});
