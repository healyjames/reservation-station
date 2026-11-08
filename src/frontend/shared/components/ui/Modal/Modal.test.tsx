// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Modal from './Modal';
import FloatingTooltip from '../Tooltip/FloatingTooltip';

const renderModal = (props: Partial<Parameters<typeof Modal>[0]> = {}) =>
  render(
    <Modal open onClose={() => {}} title="Delete booking" {...props}>
      <p>Delete the booking for Ada?</p>
    </Modal>,
  );

// Page scroll lock is daisyUI CSS (`:root:has(.modal[open])`), which jsdom does not apply; it is checked in the browser.
describe('Modal', () => {
  it('is a dialog named by its title, showing its content', () => {
    const { getByRole, getByText } = renderModal();
    const dialog = getByRole('dialog', { name: 'Delete booking' });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(getByRole('heading', { level: 2, name: 'Delete booking' })).toBeTruthy();
    expect(getByText('Delete the booking for Ada?')).toBeTruthy();
  });

  it('is not shown while closed', () => {
    const { queryByRole } = renderModal({ open: false });
    expect(queryByRole('dialog')).toBeNull();
  });

  it('opens and closes when open changes', () => {
    const { getByRole, queryByRole, rerender } = renderModal({ open: false });
    rerender(
      <Modal open onClose={() => {}} title="Go to date">
        Calendar
      </Modal>,
    );
    expect(getByRole('dialog', { name: 'Go to date' })).toBeTruthy();
    rerender(
      <Modal open={false} onClose={() => {}} title="Go to date">
        Calendar
      </Modal>,
    );
    expect(queryByRole('dialog')).toBeNull();
  });

  it('has a Close button that calls onClose', () => {
    const onClose = vi.fn();
    const { getByRole } = renderModal({ onClose });
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Esc and leaves closing to the parent', () => {
    const onClose = vi.fn();
    const { getByRole } = renderModal({ onClose });
    const dialog = getByRole('dialog');
    const notCancelled = fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(notCancelled).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('calls onClose on a backdrop click but not on a click inside the box', () => {
    const onClose = vi.fn();
    const { getByRole, getByText } = renderModal({ onClose });
    fireEvent.pointerDown(getByText('Delete the booking for Ada?'));
    fireEvent.click(getByText('Delete the booking for Ada?'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(getByRole('dialog'));
    fireEvent.click(getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open when a drag starts inside the box and ends on the backdrop', () => {
    const onClose = vi.fn();
    const { getByRole, getByText } = renderModal({ onClose });
    fireEvent.pointerDown(getByText('Delete the booking for Ada?'));
    fireEvent.click(getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tells the parent when the browser closes the dialog itself', () => {
    const onClose = vi.fn();
    const { getByRole } = renderModal({ onClose });
    fireEvent(getByRole('dialog'), new Event('close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when the parent closes it', () => {
    const onClose = vi.fn();
    const { rerender } = renderModal({ onClose });
    rerender(
      <Modal open={false} onClose={onClose} title="Delete booking">
        Body
      </Modal>,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the dialog when unmounted while open', () => {
    const { unmount } = renderModal();
    unmount();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('gives portalled content the dialog to render into', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const { getByRole } = render(
      <Modal open onClose={() => {}} title="Go to date">
        <FloatingTooltip open anchor={anchor}>
          Fully booked
        </FloatingTooltip>
      </Modal>,
    );
    expect(getByRole('dialog').contains(getByRole('tooltip'))).toBe(true);
    anchor.remove();
  });

  it('shows footer actions', () => {
    const { getByRole } = renderModal({ footer: <button type="button">Delete</button> });
    expect(getByRole('dialog').contains(getByRole('button', { name: 'Delete' }))).toBe(true);
  });

  it('keeps its own accessible name and passes other attributes to the dialog', () => {
    const { getByRole } = renderModal({
      id: 'delete-modal',
      ...{ 'aria-label': 'Other', 'aria-labelledby': 'elsewhere' },
    } as Partial<Parameters<typeof Modal>[0]>);
    const dialog = getByRole('dialog', { name: 'Delete booking' });
    expect(dialog.id).toBe('delete-modal');
    expect(dialog.getAttribute('aria-label')).toBeNull();
  });
});
