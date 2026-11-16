// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Drawer, { DrawerToggle } from './Drawer';

const SIDE_ID = 'admin-drawer';

type HarnessProps = { initialOpen?: boolean; onOpenChange?: (open: boolean) => void; panelToggle?: boolean };

const Harness = ({ initialOpen = false, onOpenChange, panelToggle = false }: HarnessProps) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <Drawer
      sideId={SIDE_ID}
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        setOpen(next);
      }}
      side={
        <nav aria-label="Admin navigation">
          {panelToggle && <DrawerToggle label="Collapse" on="-" off="+" />}
          <a href="#/bookings">Bookings</a>
        </nav>
      }
      data-testid="drawer"
    >
      <DrawerToggle label="Navigation" on="close" off="open" />
      <main>Page</main>
    </Drawer>
  );
};

const stubDocked = (docked: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: docked, media: query }) as MediaQueryList);

const overlay = (container: Element) => container.querySelector('[data-drawer-overlay]') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('Drawer', () => {
  it('renders the page and the side panel with the given id', () => {
    const { getByRole, getByText } = render(<Harness />);
    expect(getByText('Page')).toBeTruthy();
    const panel = document.getElementById(SIDE_ID);
    expect(panel?.contains(getByRole('navigation', { name: 'Admin navigation' }))).toBe(true);
  });

  it('toggle flips aria-expanded and points aria-controls at the panel', () => {
    const { getByRole } = render(<Harness />);
    const toggle = getByRole('button', { name: 'Navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(SIDE_ID);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('the hidden checkbox mirrors open and is out of the tab order and the accessibility tree', () => {
    const { getByRole, container } = render(<Harness />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.tabIndex).toBe(-1);
    expect(checkbox.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(getByRole('button', { name: 'Navigation' }));
    expect(checkbox.checked).toBe(true);
  });

  it('the overlay closes it', () => {
    const onOpenChange = vi.fn();
    const { getByRole, container } = render(<Harness initialOpen onOpenChange={onOpenChange} />);
    fireEvent.click(overlay(container));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getByRole('button', { name: 'Navigation' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('Esc closes the overlay below lg and returns focus to the toggle', () => {
    stubDocked(false);
    const { getByRole } = render(<Harness initialOpen />);
    const link = getByRole('link', { name: 'Bookings' });
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    const toggle = getByRole('button', { name: 'Navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('opening below lg from the toggle focuses the first control in the panel', () => {
    stubDocked(false);
    const { getByRole } = render(<Harness />);
    fireEvent.click(getByRole('button', { name: 'Navigation' }));
    expect(document.activeElement).toBe(getByRole('link', { name: 'Bookings' }));
  });

  it('opening while docked leaves focus on the toggle', () => {
    stubDocked(true);
    const { getByRole } = render(<Harness />);
    const toggle = getByRole('button', { name: 'Navigation' });
    toggle.focus();
    fireEvent.click(toggle);
    expect(document.activeElement).toBe(toggle);
  });

  it('starting open does not move focus', () => {
    stubDocked(false);
    render(<Harness initialOpen />);
    expect(document.activeElement).toBe(document.body);
  });

  it('Esc returns focus to the toggle outside the panel, not one inside it', () => {
    stubDocked(false);
    const { getByRole } = render(<Harness initialOpen panelToggle />);
    const link = getByRole('link', { name: 'Bookings' });
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(document.activeElement).toBe(getByRole('button', { name: 'Navigation' }));
  });

  it('Esc with focus outside the panel closes it without moving focus', () => {
    stubDocked(false);
    const { getByRole } = render(<Harness initialOpen />);
    const toggle = getByRole('button', { name: 'Navigation' });
    toggle.focus();
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('ignores Esc while closed and other keys while open', () => {
    stubDocked(false);
    const onOpenChange = vi.fn();
    const { rerender } = render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    rerender(<Harness initialOpen onOpenChange={onOpenChange} key="open" />);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('Esc does nothing while docked (lg and up)', () => {
    stubDocked(true);
    const onOpenChange = vi.fn();
    render(<Harness initialOpen onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ignores an Esc already handled elsewhere or pressed inside a dialog', () => {
    stubDocked(false);
    const onOpenChange = vi.fn();
    const { container } = render(<Harness initialOpen onOpenChange={onOpenChange} />);
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    const dialog = document.createElement('dialog');
    container.appendChild(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('passes other attributes to the root', () => {
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('drawer').contains(document.getElementById(SIDE_ID))).toBe(true);
  });

  it('DrawerToggle outside a Drawer throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<DrawerToggle label="Navigation" on="x" off="y" />)).toThrow(/inside a Drawer/);
  });
});
