// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    const { getByText } = render(<Badge>4 guests</Badge>);
    expect(getByText('4 guests')).toBeTruthy();
  });

  it('renders rich children in both variants', () => {
    const { getByText } = render(
      <>
        <Badge>
          <strong>6</strong> covers
        </Badge>
        <Badge variant="primary">today</Badge>
      </>,
    );
    expect(getByText('6').tagName).toBe('STRONG');
    expect(getByText('today')).toBeTruthy();
  });

  it('passes other attributes through', () => {
    const { getByText } = render(
      <Badge id="guests-badge" title="Party size" aria-label="4 guests">
        4
      </Badge>,
    );
    const badge = getByText('4');
    expect(badge.id).toBe('guests-badge');
    expect(badge.getAttribute('title')).toBe('Party size');
    expect(badge.getAttribute('aria-label')).toBe('4 guests');
  });
});
