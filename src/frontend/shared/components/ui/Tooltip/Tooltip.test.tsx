// @vitest-environment jsdom
import { render, fireEvent, act } from '@testing-library/preact';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Tooltip from './Tooltip';
import FloatingTooltip from './FloatingTooltip';

const pressEscape = () => fireEvent.keyDown(document, { key: 'Escape' });

describe('Tooltip', () => {
  const renderInfoTip = () =>
    render(
      <Tooltip content="Maximum guests in one booking">
        <button type="button">Max guests info</button>
      </Tooltip>,
    );

  it('describes its trigger with the tip text', () => {
    const { getByRole } = renderInfoTip();
    const trigger = getByRole('button', { name: 'Max guests info' });
    expect(trigger.getAttribute('aria-describedby')).toBe(getByRole('tooltip', { hidden: true }).id);
    expect(getByRole('tooltip', { hidden: true }).textContent).toBe('Maximum guests in one booking');
  });

  it("keeps the trigger's own aria-describedby", () => {
    const { getByRole } = render(
      <Tooltip content="Tip">
        <button type="button" aria-describedby="hint">
          Trigger
        </button>
      </Tooltip>,
    );
    const ids = getByRole('button').getAttribute('aria-describedby')?.split(' ');
    expect(ids).toEqual(['hint', getByRole('tooltip', { hidden: true }).id]);
  });

  // Showing on hover/keyboard focus is daisyUI CSS (`:hover`, `:has(:focus-visible)`), which jsdom does not apply;
  // it is checked in the browser. These tests cover the Esc dismissal the component adds.
  it('hides the tip on Esc while the trigger has keyboard focus, and restores it after focus leaves', () => {
    const { getByRole, getByText } = renderInfoTip();
    const trigger = getByRole('button');
    act(() => trigger.focus());
    expect(trigger.parentElement?.hasAttribute('data-dismissed')).toBe(false);

    const notCancelled = pressEscape();
    expect(notCancelled).toBe(false);
    expect(getByText('Maximum guests in one booking').hidden).toBe(true);
    expect(trigger.parentElement?.getAttribute('data-dismissed')).toBe('true');

    act(() => trigger.blur());
    expect(getByText('Maximum guests in one booking').hidden).toBe(false);
  });

  it('hides the tip on Esc while hovered, and restores it after the pointer leaves', () => {
    const { getByRole, getByText } = renderInfoTip();
    const wrapper = getByRole('button').parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    pressEscape();
    expect(getByText('Maximum guests in one booking').hidden).toBe(true);

    fireEvent.mouseLeave(wrapper);
    expect(getByText('Maximum guests in one booking').hidden).toBe(false);
  });

  it('leaves Esc to other handlers when it is neither hovered nor focused', () => {
    const { getByText } = renderInfoTip();
    const laterHandler = vi.fn();
    document.addEventListener('keydown', laterHandler);
    const notCancelled = pressEscape();
    document.removeEventListener('keydown', laterHandler);
    expect(notCancelled).toBe(true);
    expect(laterHandler).toHaveBeenCalledOnce();
    expect(getByText('Maximum guests in one booking').hidden).toBe(false);
  });

  it('still calls caller hover handlers', () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const { getByRole } = render(
      <Tooltip content="Tip" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const wrapper = getByRole('button').parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseLeave(wrapper);
    expect(onMouseEnter).toHaveBeenCalledOnce();
    expect(onMouseLeave).toHaveBeenCalledOnce();
  });
});

describe('FloatingTooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const makeAnchor = () => {
    const anchor = document.createElement('button');
    anchor.textContent = '14';
    document.body.appendChild(anchor);
    return anchor;
  };

  it('renders nothing when closed or without an anchor', () => {
    const anchor = makeAnchor();
    const { queryByRole, rerender } = render(
      <FloatingTooltip open={false} anchor={anchor}>
        Fully booked
      </FloatingTooltip>,
    );
    expect(queryByRole('tooltip')).toBeNull();
    rerender(
      <FloatingTooltip open anchor={null}>
        Fully booked
      </FloatingTooltip>,
    );
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('shows the message as a tooltip and describes the anchor while open', () => {
    const anchor = makeAnchor();
    const { getByRole, rerender } = render(
      <FloatingTooltip open anchor={anchor}>
        Bookings currently unavailable for this date
      </FloatingTooltip>,
    );
    const tooltip = getByRole('tooltip');
    expect(tooltip.textContent).toContain('Bookings currently unavailable for this date');
    expect(anchor.getAttribute('aria-describedby')).toBe(tooltip.id);

    rerender(
      <FloatingTooltip open={false} anchor={anchor}>
        Bookings currently unavailable for this date
      </FloatingTooltip>,
    );
    expect(anchor.hasAttribute('aria-describedby')).toBe(false);
  });

  it("restores the anchor's own aria-describedby when it closes", () => {
    const anchor = makeAnchor();
    anchor.setAttribute('aria-describedby', 'legend');
    const { getByRole, unmount } = render(
      <FloatingTooltip open anchor={anchor}>
        Closed
      </FloatingTooltip>,
    );
    expect(anchor.getAttribute('aria-describedby')).toBe(`legend ${getByRole('tooltip').id}`);
    unmount();
    expect(anchor.getAttribute('aria-describedby')).toBe('legend');
  });

  it('has a named close button that calls onClose', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <FloatingTooltip open anchor={makeAnchor()} onClose={onClose}>
        Closed
      </FloatingTooltip>,
    );
    fireEvent.click(getByRole('button', { name: 'Close tooltip' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has no close button without onClose', () => {
    const { queryByRole } = render(
      <FloatingTooltip open anchor={makeAnchor()}>
        Closed
      </FloatingTooltip>,
    );
    expect(queryByRole('button', { name: 'Close tooltip' })).toBeNull();
  });

  it('calls onClose on Esc and consumes the key', () => {
    const onClose = vi.fn();
    render(
      <FloatingTooltip open anchor={makeAnchor()} onClose={onClose}>
        Closed
      </FloatingTooltip>,
    );
    expect(pressEscape()).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves Esc alone without onClose', () => {
    render(
      <FloatingTooltip open anchor={makeAnchor()}>
        Closed
      </FloatingTooltip>,
    );
    expect(pressEscape()).toBe(true);
  });

  it('calls onClose once the timeout passes, even if it re-renders with a new onClose', () => {
    vi.useFakeTimers();
    const anchor = makeAnchor();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <FloatingTooltip open anchor={anchor} onClose={first} timeout={3000}>
        Closed
      </FloatingTooltip>,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(
      <FloatingTooltip open anchor={anchor} onClose={second} timeout={3000}>
        Closed
      </FloatingTooltip>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('positions itself above the anchor', () => {
    const anchor = makeAnchor();
    anchor.getBoundingClientRect = () => ({ top: 200, left: 100, width: 40 }) as DOMRect;
    const { getByRole } = render(
      <FloatingTooltip open anchor={anchor}>
        Closed
      </FloatingTooltip>,
    );
    expect(getByRole('tooltip').style.top).toBe('192px');
    expect(getByRole('tooltip').style.left).toBe('120px');
  });
});
