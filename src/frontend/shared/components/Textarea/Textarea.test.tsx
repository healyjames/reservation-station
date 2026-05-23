// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('renders without throwing', () => {
    const { container } = render(<Textarea />);
    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('applies correct rows attribute', () => {
    const { container } = render(<Textarea rows={5} />);
    expect(container.querySelector('textarea')?.getAttribute('rows')).toBe('5');
  });

  it('uses default rows of 3', () => {
    const { container } = render(<Textarea />);
    expect(container.querySelector('textarea')?.getAttribute('rows')).toBe('3');
  });

  it('renders hint text', () => {
    const { getByText } = render(<Textarea hint="Max 500 characters" />);
    expect(getByText('Max 500 characters')).toBeTruthy();
  });
});
