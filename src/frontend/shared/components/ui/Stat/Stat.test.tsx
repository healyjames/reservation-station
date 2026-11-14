// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Stat from './Stat';

describe('Stat', () => {
  it('reads as title then value', () => {
    const { container } = render(<Stat title="Covers" value={12} />);
    expect(container.textContent).toBe('Covers12');
  });

  it('reads the description last', () => {
    const { container } = render(<Stat title="Covers" value={12} desc="4 bookings" />);
    expect(container.textContent).toBe('Covers124 bookings');
  });

  it('renders a value of 0', () => {
    const { getByText } = render(<Stat title="Covers" value={0} />);
    expect(getByText('0')).toBeTruthy();
  });

  it('renders a description of 0 as a description', () => {
    const { container } = render(<Stat title="Bookings" value={3} desc={0} />);
    expect(container.textContent).toBe('Bookings30');
    expect(container.firstElementChild?.firstElementChild?.children.length).toBe(3);
  });

  it('renders nothing for a falsy description', () => {
    const { container } = render(<Stat title="Covers" value={3} desc={false} />);
    expect(container.textContent).toBe('Covers3');
    // Root > stat > title and value only: no empty description element.
    expect(container.firstElementChild?.firstElementChild?.children.length).toBe(2);
  });

  it('passes other attributes to the root', () => {
    const { container } = render(<Stat id="summary-text" data-day="2026-06-01" title="Covers" value={2} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.id).toBe('summary-text');
    expect(root.getAttribute('data-day')).toBe('2026-06-01');
  });
});
