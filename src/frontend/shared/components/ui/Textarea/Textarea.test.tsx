// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Textarea from './Textarea';
import Fieldset from '../Fieldset';

describe('Textarea', () => {
  it('is a multi-line text box with 3 rows by default', () => {
    const { getByRole } = render(<Textarea aria-label="Dietary requirements" />);
    const textarea = getByRole('textbox', { name: 'Dietary requirements' }) as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.rows).toBe(3);
  });

  it('passes rows and native attributes through', () => {
    const { getByRole } = render(
      <Textarea aria-label="Notes" id="dietary" name="dietary" rows={5} maxLength={500} placeholder="Allergies" required />,
    );
    const textarea = getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement;
    expect(textarea.rows).toBe(5);
    expect(textarea.id).toBe('dietary');
    expect(textarea.name).toBe('dietary');
    expect(textarea.maxLength).toBe(500);
    expect(textarea.placeholder).toBe('Allergies');
    expect(textarea.required).toBe(true);
  });

  it('calls onInput when the user types', () => {
    const onInput = vi.fn();
    const { getByRole } = render(<Textarea aria-label="Notes" value="" onInput={onInput} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    textarea.value = 'No nuts';
    fireEvent.input(textarea);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('fires onChange on each keystroke, because preact/compat maps it to input', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Textarea aria-label="Notes" onChange={onChange} />);
    fireEvent.input(getByRole('textbox'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('receives the label and error link from ui/Fieldset on the native textarea', () => {
    const { getByLabelText } = render(
      <Fieldset label="Dietary requirements" htmlFor="dietary" error="Keep it under 500 characters">
        <Textarea id="dietary" />
      </Fieldset>,
    );
    const textarea = getByLabelText('Dietary requirements');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(textarea.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Keep it under 500 characters');
  });

  it('links a Fieldset hint, which replaces the legacy hint prop', () => {
    const { getByLabelText } = render(
      <Fieldset label="Dietary requirements" htmlFor="dietary" hint="Optional">
        <Textarea id="dietary" />
      </Fieldset>,
    );
    const textarea = getByLabelText('Dietary requirements');
    expect(document.getElementById(textarea.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Optional');
  });
});
