// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import ToggleSwitch from './ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders without throwing', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={() => {}} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('input is checked when checked prop is true', () => {
    const { container } = render(<ToggleSwitch checked={true} onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
  });

  it('input is not checked when checked prop is false', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(false);
  });

  it('calls onChange when toggled', () => {
    const onChange = vi.fn();
    const { container } = render(<ToggleSwitch checked={false} onChange={onChange} />);
    fireEvent.click(container.querySelector('input')!);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    const { container } = render(<ToggleSwitch checked={false} onChange={onChange} disabled />);
    fireEvent.click(container.querySelector('input')!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders label text when provided', () => {
    const { getByText } = render(<ToggleSwitch checked={false} onChange={() => {}} label="Enable feature" />);
    expect(getByText('Enable feature')).toBeTruthy();
  });
});
