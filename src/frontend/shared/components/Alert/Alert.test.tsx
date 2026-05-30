// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Alert from './Alert';

describe('Alert', () => {
  it('sets aria-hidden when visible is false', () => {
    const { container } = render(<Alert variant="error" message="Oops" visible={false} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not set aria-hidden when visible is true', () => {
    const { container } = render(<Alert variant="error" message="Oops" visible={true} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies variant class', () => {
    const { container } = render(<Alert variant="success" message="Done" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('success');
  });

  it('renders message text', () => {
    const { getByText } = render(<Alert variant="info" message="FYI" />);
    expect(getByText('FYI')).toBeTruthy();
  });
});
