// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import MessageCard from './MessageCard';

describe('MessageCard', () => {
  it('renders without throwing', () => {
    const { getByText } = render(
      <MessageCard variant="success" title="Booking Confirmed!">
        <p>Your reservation is set.</p>
      </MessageCard>,
    );
    expect(getByText('Booking Confirmed!')).toBeTruthy();
  });

  it('applies success variant class', () => {
    const { container } = render(
      <MessageCard variant="success" title="Done">
        <p>OK</p>
      </MessageCard>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('success');
  });

  it('applies error variant class', () => {
    const { container } = render(
      <MessageCard variant="error" title="Failed">
        <p>Oops</p>
      </MessageCard>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('error');
  });

  it('renders children', () => {
    const { getByText } = render(
      <MessageCard variant="success" title="Title">
        <p>Body content</p>
      </MessageCard>,
    );
    expect(getByText('Body content')).toBeTruthy();
  });
});
