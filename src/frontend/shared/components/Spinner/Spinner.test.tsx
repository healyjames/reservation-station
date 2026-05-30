// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Spinner from './Spinner';

describe('Spinner', () => {
  it('renders without throwing', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('applies sm size class', () => {
    const { container } = render(<Spinner size="sm" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('sm');
  });

  it('applies md size class by default', () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('md');
  });

  it('uses default label', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('[aria-label="Loading"]')).toBeTruthy();
  });

  it('uses custom label', () => {
    const { container } = render(<Spinner label="Please wait" />);
    expect(container.querySelector('[aria-label="Please wait"]')).toBeTruthy();
  });
});
