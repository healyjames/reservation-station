// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Swap from './Swap';
import SwapCheckbox from './SwapCheckbox';

describe('Swap', () => {
  it('is a named toggle button reporting aria-pressed by default', () => {
    const { getByRole, rerender } = render(<Swap label="Bold" active={false} on="B!" off="B" />);
    expect(getByRole('button', { name: 'Bold', pressed: false })).toBeTruthy();
    rerender(<Swap label="Bold" active on="B!" off="B" />);
    expect(getByRole('button', { name: 'Bold', pressed: true })).toBeTruthy();
  });

  it('reports aria-expanded instead when it controls a disclosure', () => {
    const { getByRole } = render(<Swap label="Navigation" state="expanded" active aria-controls="admin-drawer" on="close" off="open" />);
    const button = getByRole('button', { name: 'Navigation', expanded: true });
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.getAttribute('aria-controls')).toBe('admin-drawer');
  });

  it('shows which state it is in through data-active', () => {
    const { getByRole, rerender } = render(<Swap label="Menu" active={false} on="x" off="=" />);
    expect(getByRole('button').hasAttribute('data-active')).toBe(false);
    rerender(<Swap label="Menu" active on="x" off="=" />);
    expect(getByRole('button').getAttribute('data-active')).toBe('true');
  });

  it('renders both faces and calls onClick', () => {
    const onClick = vi.fn();
    const { getByRole, getByText } = render(<Swap label="Menu" active={false} on="Close" off="Open" onClick={onClick} />);
    expect(getByText('Close')).toBeTruthy();
    expect(getByText('Open')).toBeTruthy();
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps its own name, state and type when a caller passes them', () => {
    const { getByRole } = render(
      <Swap
        label="Menu"
        active={false}
        on="x"
        off="="
        {...{ type: 'submit', 'aria-label': 'Other', 'aria-pressed': 'true', 'aria-expanded': 'true' }}
      />,
    );
    const button = getByRole('button', { name: 'Menu', pressed: false });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('aria-expanded')).toBe(false);
  });
});

describe('SwapCheckbox', () => {
  it('is a named checkbox whose checked state follows the prop', () => {
    const { getByRole, rerender } = render(<SwapCheckbox label="Dark mode" checked={false} onChange={() => {}} on="moon" off="sun" />);
    expect(getByRole('checkbox', { name: 'Dark mode', checked: false })).toBeTruthy();
    rerender(<SwapCheckbox label="Dark mode" checked onChange={() => {}} on="moon" off="sun" />);
    expect(getByRole('checkbox', { name: 'Dark mode', checked: true })).toBeTruthy();
  });

  it('reports the new checked value on change', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<SwapCheckbox label="Dark mode" checked={false} onChange={onChange} on="moon" off="sun" />);
    fireEvent.click(getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('stays unchecked when the parent does not accept the change', () => {
    const { getByRole } = render(<SwapCheckbox label="Dark mode" checked={false} onChange={() => {}} on="moon" off="sun" />);
    fireEvent.click(getByRole('checkbox'));
    expect(getByRole('checkbox', { checked: false })).toBeTruthy();
  });

  it('hides the icon faces from assistive tech', () => {
    const { getByText } = render(<SwapCheckbox label="Dark mode" checked={false} onChange={() => {}} on="moon" off="sun" />);
    expect(getByText('moon').getAttribute('aria-hidden')).toBe('true');
    expect(getByText('sun').getAttribute('aria-hidden')).toBe('true');
  });

  it('puts other attributes on the checkbox and keeps its own name', () => {
    const { getByRole } = render(
      <SwapCheckbox
        label="Dark mode"
        checked={false}
        onChange={() => {}}
        on="moon"
        off="sun"
        id="theme-toggle"
        {...{ 'aria-label': 'Other', 'aria-labelledby': 'x', 'aria-checked': 'true', type: 'button' }}
      />,
    );
    const checkbox = getByRole('checkbox', { name: 'Dark mode', checked: false });
    expect(checkbox.id).toBe('theme-toggle');
    expect(checkbox.hasAttribute('aria-checked')).toBe(false);
    expect(checkbox.hasAttribute('aria-labelledby')).toBe(false);
  });
});
