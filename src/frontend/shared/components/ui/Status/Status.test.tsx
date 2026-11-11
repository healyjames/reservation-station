// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Status from './Status';

describe('Status', () => {
  it('is decorative by default', () => {
    const { container, queryByRole } = render(<Status color="primary" size="sm" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(queryByRole('img')).toBeNull();
  });

  it('is an image named by its label', () => {
    const { container, getByRole } = render(<Status color="error" size="xl" label="Blocked" />);
    expect(getByRole('img', { name: 'Blocked' })).toBeTruthy();
    expect(container.firstElementChild?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('treats an empty label as decorative', () => {
    const { container, queryByRole } = render(<Status color="primary" size="sm" label="" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(queryByRole('img')).toBeNull();
  });

  it('stays decorative when passed a role or name without a label', () => {
    const { container, queryByRole } = render(<Status color="error" size="xl" {...{ role: 'img', 'aria-label': 'Other' }} />);
    expect(queryByRole('img')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstElementChild?.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps its own accessibility attributes over passed ones', () => {
    const { container, getByRole } = render(
      <Status
        color="primary"
        size="sm"
        label="Today"
        id="today-dot"
        {...{ role: 'button', 'aria-label': 'Other', 'aria-labelledby': 'x', 'aria-hidden': 'true' }}
      />,
    );
    const dot = getByRole('img', { name: 'Today' });
    expect(dot.id).toBe('today-dot');
    expect(dot.hasAttribute('aria-labelledby')).toBe(false);
    expect(container.firstElementChild?.hasAttribute('aria-hidden')).toBe(false);
  });
});
