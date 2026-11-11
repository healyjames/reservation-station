// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('is a banner landmark by default', () => {
    const { getByRole } = render(<Navbar start={<span>The Anchor</span>} />);
    expect(within(getByRole('banner')).getByText('The Anchor')).toBeTruthy();
  });

  it('renders the element given by as', () => {
    const { getByRole, queryByRole } = render(<Navbar as="nav" aria-label="Account" end={<button type="button">Sign out</button>} />);
    expect(within(getByRole('navigation', { name: 'Account' })).getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(queryByRole('banner')).toBeNull();
  });

  it('can be no landmark', () => {
    const { queryByRole, getByText } = render(<Navbar as="div" center="Bookings" />);
    expect(queryByRole('banner')).toBeNull();
    expect(getByText('Bookings')).toBeTruthy();
  });

  it('renders the slots in order: start, center, end', () => {
    const { getByRole } = render(
      <Navbar start={<button type="button">Open menu</button>} center={<h1>Bookings</h1>} end={<span>The Anchor</span>} />,
    );
    expect(getByRole('banner').textContent).toBe('Open menuBookingsThe Anchor');
  });

  it('renders only the slots given', () => {
    const { getByRole } = render(<Navbar start="A" center={false} end="" />);
    expect(getByRole('banner').children).toHaveLength(1);
  });

  it('keeps both sides around a center so it stays centred', () => {
    const { getByRole } = render(<Navbar center={<h1>Bookings</h1>} />);
    const header = getByRole('banner');
    expect(header.children).toHaveLength(3);
    expect(header.children[1].textContent).toBe('Bookings');
  });

  it('passes other attributes to the root', () => {
    const { getByRole } = render(<Navbar id="admin-header" data-page="bookings" start="A" />);
    const header = getByRole('banner');
    expect(header.id).toBe('admin-header');
    expect(header.getAttribute('data-page')).toBe('bookings');
  });
});
