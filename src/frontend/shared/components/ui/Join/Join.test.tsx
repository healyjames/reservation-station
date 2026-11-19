// @vitest-environment jsdom
import { render, within } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Join from './Join';
import { ChevronLeft, ChevronRight } from '../icons';

describe('Join', () => {
  it('is a group named by aria-label, with its children in order', () => {
    const { getByRole } = render(
      <Join aria-label="Month">
        <button type="button" class="join-item" aria-label="Previous month">
          <ChevronLeft />
        </button>
        <span class="join-item">June 2026</span>
        <button type="button" class="join-item" aria-label="Next month">
          <ChevronRight />
        </button>
      </Join>,
    );
    const group = getByRole('group', { name: 'Month' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Previous month', 'Next month']);
    expect(group.textContent).toBe('June 2026');
  });

  it('is a group without a name too', () => {
    const { getByRole } = render(
      <Join>
        <button type="button">A</button>
      </Join>,
    );
    expect(within(getByRole('group')).getByRole('button', { name: 'A' })).toBeTruthy();
  });

  it('keeps its role and passes other attributes through', () => {
    // role is not in the props type; the spread forces it, to prove Join keeps its own.
    const { getByRole } = render(
      <Join id="date-nav" data-view="day" {...{ role: 'toolbar' }}>
        <button type="button">A</button>
      </Join>,
    );
    const group = getByRole('group');
    expect(group.id).toBe('date-nav');
    expect(group.getAttribute('data-view')).toBe('day');
  });
});
