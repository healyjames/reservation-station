// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import DayCell from './DayCell';

// Minimal styles stub — maps class names to themselves so assertions work
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => prop,
});

describe('DayCell', () => {
  it('renders the day number', () => {
    const { getByText } = render(
      <DayCell day={15} isToday={false} isPast={false} isSelected={false} isBlocked={false} isDisabled={false} styles={styles} />,
    );
    expect(getByText('15')).toBeTruthy();
  });

  it('past day has aria-disabled and role=gridcell, no tab interaction', () => {
    const { container } = render(
      <DayCell day={5} isToday={false} isPast={true} isSelected={false} isBlocked={false} isDisabled={true} styles={styles} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('role')).toBe('gridcell');
    expect(el.getAttribute('tabindex')).toBeNull();
  });

  it('blocked day has aria-disabled, role=gridcell, and tabIndex=0', () => {
    const { container } = render(
      <DayCell day={10} isToday={false} isPast={false} isSelected={false} isBlocked={true} isDisabled={true} styles={styles} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('role')).toBe('gridcell');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('blocked day calls onBlockedSelect on click', () => {
    const onBlockedSelect = vi.fn();
    const { container } = render(
      <DayCell
        day={10}
        isToday={false}
        isPast={false}
        isSelected={false}
        isBlocked={true}
        isDisabled={true}
        onBlockedSelect={onBlockedSelect}
        styles={styles}
      />,
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onBlockedSelect).toHaveBeenCalledOnce();
  });

  it('normal day has role=button and aria-pressed=false when not selected', () => {
    const { container } = render(
      <DayCell day={20} isToday={false} isPast={false} isSelected={false} isBlocked={false} isDisabled={false} styles={styles} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('aria-pressed')).toBe('false');
  });

  it('selected day has aria-pressed=true', () => {
    const { container } = render(
      <DayCell day={20} isToday={false} isPast={false} isSelected={true} isBlocked={false} isDisabled={false} styles={styles} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-pressed')).toBe('true');
  });

  it('normal day calls onSelect on click', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <DayCell
        day={20}
        isToday={false}
        isPast={false}
        isSelected={false}
        isBlocked={false}
        isDisabled={false}
        onSelect={onSelect}
        styles={styles}
      />,
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('today day includes today class', () => {
    const { container } = render(
      <DayCell day={1} isToday={true} isPast={false} isSelected={false} isBlocked={false} isDisabled={false} styles={styles} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('today');
  });
});
