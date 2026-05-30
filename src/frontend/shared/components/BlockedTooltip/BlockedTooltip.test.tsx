// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import BlockedTooltip from './BlockedTooltip';

const mockRect = {
  top: 200,
  left: 100,
  width: 40,
  height: 40,
  bottom: 240,
  right: 140,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect;

describe('BlockedTooltip', () => {
  it('renders nothing when visible=false', () => {
    const { queryByRole } = render(
      <BlockedTooltip visible={false} message="Fully booked" anchorRect={mockRect} onClose={() => {}} />
    );
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('renders nothing when anchorRect=null', () => {
    const { queryByRole } = render(
      <BlockedTooltip visible={true} message="Fully booked" anchorRect={null} onClose={() => {}} />
    );
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('renders tooltip when visible=true and anchorRect provided', () => {
    const { getByRole } = render(
      <BlockedTooltip visible={true} message="Fully booked" anchorRect={mockRect} onClose={() => {}} />
    );
    expect(getByRole('tooltip')).toBeTruthy();
  });

  it('displays the message text', () => {
    const { getByText } = render(
      <BlockedTooltip visible={true} message="No availability" anchorRect={mockRect} onClose={() => {}} />
    );
    expect(getByText('No availability')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <BlockedTooltip visible={true} message="Fully booked" anchorRect={mockRect} onClose={onClose} />
    );
    fireEvent.click(getByLabelText('Close tooltip'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
