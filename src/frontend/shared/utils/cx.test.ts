import { describe, it, expect } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins class names with a single space', () => {
    expect(cx('btn', 'btn-primary')).toBe('btn btn-primary');
  });

  it('drops falsy values', () => {
    const isActive = false;
    expect(cx('btn', isActive && 'btn-active', null, undefined, '', 'btn-sm')).toBe('btn btn-sm');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(undefined, false)).toBe('');
  });
});
