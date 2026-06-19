// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('renders children when open', () => {
    const { getByText } = render(
      <Modal open onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(getByText('Modal content')).toBeTruthy();
  });

  it('renders title when provided', () => {
    const { getByText } = render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>Body</p>
      </Modal>,
    );
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('renders footer when provided', () => {
    const { getByText } = render(
      <Modal open onClose={() => {}} footer={<button>OK</button>}>
        <p>Body</p>
      </Modal>,
    );
    expect(getByText('OK')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <Modal open onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>,
    );
    getByLabelText('Close').click();
    expect(onClose).toHaveBeenCalled();
  });
});
