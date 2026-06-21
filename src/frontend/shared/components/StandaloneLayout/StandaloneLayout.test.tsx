// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import StandaloneLayout from './StandaloneLayout';

describe('StandaloneLayout', () => {
  it('renders without throwing', () => {
    const { container } = render(
      <StandaloneLayout>
        <p>Content</p>
      </StandaloneLayout>,
    );
    expect(container.querySelector('main')).toBeTruthy();
  });

  it('renders title when provided', () => {
    const { getByText } = render(
      <StandaloneLayout title="Manage Booking">
        <p>Content</p>
      </StandaloneLayout>,
    );
    expect(getByText('Manage Booking')).toBeTruthy();
  });

  it('does not render h1 when title is not provided', () => {
    const { container } = render(
      <StandaloneLayout>
        <p>Content</p>
      </StandaloneLayout>,
    );
    expect(container.querySelector('h1')).toBeNull();
  });

  it('renders children', () => {
    const { getByText } = render(
      <StandaloneLayout>
        <p>Hello world</p>
      </StandaloneLayout>,
    );
    expect(getByText('Hello world')).toBeTruthy();
  });
});
