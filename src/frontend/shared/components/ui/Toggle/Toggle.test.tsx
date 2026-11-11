// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Toggle from './Toggle';

describe('Toggle', () => {
  it('is a checkbox named by its label, reflecting checked', () => {
    const { getByRole, rerender } = render(<Toggle label="Closed" checked={false} onChange={() => {}} />);
    expect(getByRole('checkbox', { name: 'Closed', checked: false })).toBeTruthy();
    rerender(<Toggle label="Closed" checked onChange={() => {}} />);
    expect(getByRole('checkbox', { name: 'Closed', checked: true })).toBeTruthy();
  });

  it('passes the new checked value to onChange', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="Closed" checked={false} onChange={onChange} />);
    fireEvent.click(getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('stays as the parent says when the parent ignores the change', () => {
    const { getByRole } = render(<Toggle label="Closed" checked={false} onChange={() => {}} />);
    fireEvent.click(getByRole('checkbox'));
    expect(getByRole('checkbox', { checked: false })).toBeTruthy();
  });

  it('keeps an accessible name when the label is visually hidden', () => {
    const { getByRole } = render(<Toggle label="Block this day" hideLabel checked={false} onChange={() => {}} />);
    expect(getByRole('checkbox', { name: 'Block this day' })).toBeTruthy();
  });

  it('can name toggles that share visible text apart for assistive tech', () => {
    const { getByRole } = render(
      <>
        <Toggle
          label={
            <>
              Closed <span class="sr-only">on Monday</span>
            </>
          }
          checked={false}
          onChange={() => {}}
        />
        <Toggle
          label={
            <>
              Closed <span class="sr-only">on Tuesday</span>
            </>
          }
          checked
          onChange={() => {}}
        />
      </>,
    );
    expect(getByRole('checkbox', { name: 'Closed on Monday', checked: false })).toBeTruthy();
    expect(getByRole('checkbox', { name: 'Closed on Tuesday', checked: true })).toBeTruthy();
  });

  it('does not call onChange while disabled', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="Block this day" checked={false} disabled onChange={onChange} />);
    const checkbox = getByRole('checkbox', { name: 'Block this day' }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses a given id and puts other attributes on the checkbox, keeping its own name', () => {
    const { getByRole } = render(
      <Toggle
        label="Closed"
        id="oh-toggle-1"
        checked={false}
        onChange={() => {}}
        aria-describedby="oh-help"
        {...{ 'aria-label': 'Other', 'aria-checked': 'true' }}
      />,
    );
    const checkbox = getByRole('checkbox', { name: 'Closed', checked: false });
    expect(checkbox.id).toBe('oh-toggle-1');
    expect(checkbox.getAttribute('aria-describedby')).toBe('oh-help');
    expect(checkbox.hasAttribute('aria-checked')).toBe(false);
  });
});
