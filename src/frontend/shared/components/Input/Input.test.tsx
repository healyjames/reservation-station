// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Input from './Input';

describe('Input', () => {
  it('renders without throwing', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('shows error text when error prop is set', () => {
    const { getByText } = render(<Input error="Required field" />);
    expect(getByText('Required field')).toBeTruthy();
  });

  it('sets aria-invalid when ariaInvalid is true', () => {
    const { container } = render(<Input ariaInvalid />);
    expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not set aria-invalid when ariaInvalid is false', () => {
    const { container } = render(<Input ariaInvalid={false} />);
    expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('shows hint when no error', () => {
    const { getByText } = render(<Input hint="Enter your email" />);
    expect(getByText('Enter your email')).toBeTruthy();
  });

  it('hides hint when error is present', () => {
    const { queryByText } = render(<Input error="Bad" hint="Enter your email" />);
    expect(queryByText('Enter your email')).toBeNull();
  });
});
