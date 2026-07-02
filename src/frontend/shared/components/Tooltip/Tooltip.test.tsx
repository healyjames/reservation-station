// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Tooltip from './Tooltip';

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

describe('Tooltip', () => {
  it('renders nothing when visible=false', () => {
    const { queryByRole } = render(<Tooltip visible={false} message="Fully booked" anchorRect={mockRect} />);
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('renders nothing when anchorRect=null', () => {
    const { queryByRole } = render(<Tooltip visible={true} message="Fully booked" anchorRect={null} />);
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('renders tooltip when visible=true and anchorRect provided', () => {
    const { getByRole } = render(<Tooltip visible={true} message="Fully booked" anchorRect={mockRect} />);
    expect(getByRole('tooltip')).toBeTruthy();
  });

  it('displays the message text', () => {
    const { getByText } = render(<Tooltip visible={true} message="No availability" anchorRect={mockRect} />);
    expect(getByText('No availability')).toBeTruthy();
  });

  it('shows close button when onClose is provided', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<Tooltip visible={true} message="Fully booked" anchorRect={mockRect} onClose={onClose} />);
    expect(getByLabelText('Close tooltip')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<Tooltip visible={true} message="Fully booked" anchorRect={mockRect} onClose={onClose} />);
    fireEvent.click(getByLabelText('Close tooltip'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render close button when onClose is omitted', () => {
    const { queryByLabelText } = render(<Tooltip visible={true} message="Fully booked" anchorRect={mockRect} />);
    expect(queryByLabelText('Close tooltip')).toBeNull();
  });
});
