// @vitest-environment jsdom
import { render, fireEvent, within } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import { CalendarDays, LogOut } from '../icons';
import Menu, { MenuItem } from './Menu';

describe('Menu', () => {
  it('renders links and buttons named by their labels', () => {
    const onSignOut = vi.fn();
    const { getByRole } = render(
      <nav aria-label="Admin navigation">
        <Menu>
          <MenuItem href="#/bookings" label="Bookings" icon={<CalendarDays />} />
          <MenuItem label="Sign out" icon={<LogOut />} onClick={onSignOut} />
        </Menu>
      </nav>,
    );
    const nav = getByRole('navigation', { name: 'Admin navigation' });
    expect(within(nav).getByRole('link', { name: 'Bookings' }).getAttribute('href')).toBe('#/bookings');
    fireEvent.click(within(nav).getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks only the active item as the current page', () => {
    const { getByRole } = render(
      <Menu>
        <MenuItem href="#/bookings" label="Bookings" active />
        <MenuItem href="#/general" label="General" />
      </Menu>,
    );
    expect(getByRole('link', { name: 'Bookings' }).getAttribute('aria-current')).toBe('page');
    expect(getByRole('link', { name: 'General' }).hasAttribute('aria-current')).toBe(false);
  });

  it('keeps the label as the name, with a tooltip repeating it, and ignores a passed name', () => {
    const { getByRole } = render(
      <Menu>
        <MenuItem
          href="#/hours"
          label="Opening Hours"
          icon={<CalendarDays />}
          tooltip
          {...{ 'aria-label': 'Other', 'aria-labelledby': 'x', 'aria-current': 'step' }}
        />
      </Menu>,
    );
    const link = getByRole('link', { name: 'Opening Hours' });
    expect(link.hasAttribute('aria-labelledby')).toBe(false);
    expect(link.hasAttribute('aria-current')).toBe(false);
    expect(getByRole('listitem').getAttribute('data-tip')).toBe('Opening Hours');
  });

  it('has no tooltip unless asked', () => {
    const { getByRole } = render(
      <Menu>
        <MenuItem href="#/bookings" label="Bookings" />
      </Menu>,
    );
    expect(getByRole('listitem').hasAttribute('data-tip')).toBe(false);
  });

  it('dismisses the tooltip on Esc without consuming it, until focus and pointer leave', () => {
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', onKeyDown);
    const { getByRole } = render(
      <Menu>
        <MenuItem href="#/bookings" label="Bookings" tooltip />
      </Menu>,
    );
    const item = getByRole('listitem');
    const link = getByRole('link', { name: 'Bookings' });

    fireEvent.focus(link);
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(item.getAttribute('data-dismissed')).toBe('true');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveReturnedWith(false);

    fireEvent.blur(link);
    expect(item.hasAttribute('data-dismissed')).toBe(false);

    fireEvent.mouseEnter(item);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(item.getAttribute('data-dismissed')).toBe('true');
    fireEvent.mouseLeave(item);
    expect(item.hasAttribute('data-dismissed')).toBe(false);
    document.removeEventListener('keydown', onKeyDown);
  });

  it('accepts other list items, and passes attributes to the list and the control', () => {
    const { getByRole } = render(
      <Menu id="admin-menu" aria-label="Sections">
        <MenuItem href="#/bookings" label="Bookings" id="nav-bookings" data-route="bookings" />
        <li>
          <span>Theme</span>
        </li>
      </Menu>,
    );
    const list = getByRole('list', { name: 'Sections' });
    expect(list.id).toBe('admin-menu');
    const link = getByRole('link', { name: 'Bookings' });
    expect(link.id).toBe('nav-bookings');
    expect(link.getAttribute('data-route')).toBe('bookings');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });
});
