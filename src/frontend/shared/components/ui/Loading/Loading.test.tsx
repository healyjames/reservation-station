// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Loading from './Loading';

describe('Loading', () => {
  it('announces "Loading" as a status by default', () => {
    const { getByRole } = render(<Loading />);
    expect(getByRole('status').textContent).toBe('Loading');
  });

  it('announces a custom label', () => {
    const { getByRole } = render(<Loading label="Loading available times" />);
    expect(getByRole('status').textContent).toBe('Loading available times');
  });

  it('still announces its label with a non-default size and variant', () => {
    const { getByRole } = render(<Loading size="xl" variant="dots" label="Saving" />);
    expect(getByRole('status').textContent).toBe('Saving');
  });

  it('is hidden from assistive tech and has no status role when decorative', () => {
    const { container, queryByRole } = render(<Loading label={null} />);
    expect(queryByRole('status')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).toBe('');
  });

  it('treats an empty label as decorative rather than an empty status', () => {
    const { queryByRole } = render(<Loading label="" />);
    expect(queryByRole('status')).toBeNull();
  });

  it('keeps its own accessible name and visibility when a caller passes ARIA attributes', () => {
    const { getByRole } = render(<Loading label="Saving" {...{ 'aria-label': 'Other', 'aria-hidden': 'true', 'aria-live': 'off' }} />);
    const status = getByRole('status');
    expect(status.getAttribute('aria-label')).toBeNull();
    expect(status.getAttribute('aria-hidden')).toBeNull();
    expect(status.getAttribute('aria-live')).toBeNull();
    expect(status.textContent).toBe('Saving');
  });

  it('puts other attributes on the root element in both modes', () => {
    const { container } = render(
      <>
        <Loading id="announcing" />
        <Loading id="decorative" label={null} />
      </>,
    );
    const [announcing, decorative] = Array.from(container.children);
    expect(announcing.id).toBe('announcing');
    expect(announcing.getAttribute('role')).toBe('status');
    expect(decorative.id).toBe('decorative');
    expect(decorative.getAttribute('aria-hidden')).toBe('true');
  });
});
