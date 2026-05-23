// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/preact';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders without throwing', () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('is disabled when isLoading is true', () => {
    const { container } = render(<Button isLoading>Save</Button>);
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders spinner when isLoading is true', () => {
    const { container } = render(<Button isLoading>Save</Button>);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('does not render spinner when not loading', () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    const { container } = render(<Button disabled onClick={onClick}>Click</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled', () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalled();
  });
});
