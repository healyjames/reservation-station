// @vitest-environment jsdom
import { render, act } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Fieldset from './Fieldset';

const describedBy = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

describe('Fieldset', () => {
  it('labels its control', () => {
    const { getByLabelText } = render(
      <Fieldset label="First name" htmlFor="first-name" required>
        <input id="first-name" required />
      </Fieldset>,
    );
    expect(getByLabelText('First name').id).toBe('first-name');
  });

  it('shows a required marker that is hidden from assistive tech', () => {
    const { getByText } = render(
      <Fieldset label="Email" htmlFor="email" required>
        <input id="email" required />
      </Fieldset>,
    );
    expect(getByText('*').getAttribute('aria-hidden')).toBe('true');
  });

  it('links a hint to the control', () => {
    const { getByLabelText } = render(
      <Fieldset label="Telephone" htmlFor="tel" hint="Include the area code">
        <input id="tel" />
      </Fieldset>,
    );
    expect(describedBy(getByLabelText('Telephone'))).toEqual(['Include the area code']);
  });

  it('shows an error as an alert, links it and marks the control invalid, replacing the hint', () => {
    const { getByLabelText, getByRole, queryByText } = render(
      <Fieldset label="Email" htmlFor="email" hint="We send the confirmation here" error="Enter a valid email">
        <input id="email" />
      </Fieldset>,
    );
    const input = getByLabelText('Email');
    expect(getByRole('alert').textContent).toBe('Enter a valid email');
    expect(describedBy(input)).toEqual(['Enter a valid email']);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(queryByText('We send the confirmation here')).toBeNull();
  });

  it("keeps the control's own aria-describedby and aria-invalid", () => {
    const { getByLabelText } = render(
      <>
        <p id="extra">Extra help</p>
        <Fieldset label="Name" htmlFor="name" hint="As on your card">
          <input id="name" aria-describedby="extra" aria-invalid="false" />
        </Fieldset>
      </>,
    );
    const input = getByLabelText('Name');
    expect(describedBy(input)).toEqual(['Extra help', 'As on your card']);
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('adds no aria-describedby without a hint or error', () => {
    const { getByLabelText } = render(
      <Fieldset label="Name" htmlFor="name">
        <input id="name" />
      </Fieldset>,
    );
    expect(getByLabelText('Name').hasAttribute('aria-describedby')).toBe(false);
  });

  it('puts a tooltip behind a named Info button that describes it', () => {
    const { getByRole } = render(
      <Fieldset label="Booking delay" htmlFor="delay" tooltip="Customers cannot book within this many hours">
        <input id="delay" />
      </Fieldset>,
    );
    const button = getByRole('button', { name: 'More about Booking delay' });
    expect(button).toBeTruthy();
    const tip = document.getElementById(button.getAttribute('aria-describedby') ?? '');
    expect(tip?.getAttribute('role')).toBe('tooltip');
    expect(tip?.textContent).toBe('Customers cannot book within this many hours');
  });

  it('dismisses the info tooltip with Esc while the Info button has keyboard focus, and resets on blur', () => {
    const { getByRole } = render(
      <Fieldset label="Booking delay" htmlFor="delay" tooltip="Customers cannot book within this many hours">
        <input id="delay" />
      </Fieldset>,
    );
    const button = getByRole('button', { name: 'More about Booking delay' });
    const tip = getByRole('tooltip', { hidden: true });
    act(() => button.focus());
    expect(tip.hidden).toBe(false);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(tip.hidden).toBe(true);

    act(() => button.blur());
    expect(tip.hidden).toBe(false);
  });

  it("labels the child's id when htmlFor is left out", () => {
    const { getByLabelText } = render(
      <Fieldset label="Surname">
        <input id="surname" />
      </Fieldset>,
    );
    expect(getByLabelText('Surname').id).toBe('surname');
  });

  it('passes other attributes to the root', () => {
    const { container } = render(
      <Fieldset label="Name" htmlFor="name" id="name-field">
        <input id="name" />
      </Fieldset>,
    );
    expect(container.firstElementChild?.id).toBe('name-field');
  });
});
