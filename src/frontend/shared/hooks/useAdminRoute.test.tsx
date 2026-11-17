// @vitest-environment jsdom
import { act, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdminRoute } from './useAdminRoute';

function ShowRoute() {
  const route = useAdminRoute();
  return <p data-testid="route">{route.value}</p>;
}

const goTo = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('useAdminRoute', () => {
  it('starts from the current URL', () => {
    window.location.hash = '#/settings/blocked-dates';
    const { getByTestId } = render(<ShowRoute />);
    expect(getByTestId('route').textContent).toBe('settings/blocked-dates');
  });

  it('follows hash changes, including back to an unknown hash', () => {
    const { getByTestId } = render(<ShowRoute />);
    expect(getByTestId('route').textContent).toBe('bookings');

    goTo('#/settings/opening-hours/specific-day');
    expect(getByTestId('route').textContent).toBe('settings/opening-hours/specific-day');

    goTo('#/nowhere');
    expect(getByTestId('route').textContent).toBe('bookings');
  });

  it('stops listening when unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ShowRoute />);
    unmount();
    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
  });
});
