// @vitest-environment jsdom
import { render } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import Alert from './Alert';

describe('Alert', () => {
  it('is a static message with no live role by default', () => {
    const { getByText, queryByRole } = render(<Alert>Your booking is saved.</Alert>);
    expect(getByText('Your booking is saved.')).toBeTruthy();
    expect(queryByRole('alert')).toBeNull();
    expect(queryByRole('status')).toBeNull();
  });

  it('interrupts assistive tech when live is assertive', () => {
    const { getByRole } = render(
      <Alert variant="error" live="assertive">
        Could not save.
      </Alert>,
    );
    const alert = getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Could not save.');
  });

  it('waits for a pause when live is polite', () => {
    const { getByRole } = render(
      <Alert variant="success" live="polite">
        Settings saved.
      </Alert>,
    );
    const status = getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Settings saved.');
  });

  it.each([2, 3, 4] as const)('shows a title as a level %i heading', (level) => {
    const { getByRole, getByText } = render(
      <Alert variant="success" title="Booking Confirmed!" headingLevel={level}>
        <p>See you soon.</p>
      </Alert>,
    );
    expect(getByRole('heading', { level, name: 'Booking Confirmed!' })).toBeTruthy();
    expect(getByText('See you soon.')).toBeTruthy();
  });

  it('requires a headingLevel with a title (checked by tsc)', () => {
    // @ts-expect-error headingLevel is required when title is set
    const { getByText } = render(<Alert title="No level" />);
    expect(getByText('No level')).toBeTruthy();
  });

  it('shows a title that is not a heading when headingLevel is null', () => {
    const { getByText, queryByRole } = render(
      <Alert variant="error" title="Error" headingLevel={null}>
        Please try again.
      </Alert>,
    );
    expect(getByText('Error')).toBeTruthy();
    expect(queryByRole('heading')).toBeNull();
  });

  it.each(['info', 'success', 'warning', 'error'] as const)('shows a decorative icon for %s', (variant) => {
    const { container } = render(<Alert variant={variant}>Message</Alert>);
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a matching icon per variant', () => {
    const { container } = render(
      <>
        <Alert variant="info">i</Alert>
        <Alert variant="success">s</Alert>
        <Alert variant="warning">w</Alert>
        <Alert variant="error">e</Alert>
      </>,
    );
    const names = Array.from(container.querySelectorAll('svg')).map((svg) => svg.getAttribute('data-icon'));
    expect(names).toEqual(['info', 'circle-check', 'circle-alert', 'circle-alert']);
  });

  it('hides the icon when icon is false', () => {
    const { container } = render(<Alert icon={false}>No icon</Alert>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders an action next to the message', () => {
    const { getByRole } = render(
      <Alert variant="warning" live="assertive" action={<button type="button">Retry</button>}>
        Could not load dates.
      </Alert>,
    );
    expect(getByRole('alert').contains(getByRole('button', { name: 'Retry' }))).toBe(true);
  });

  it('keeps its own live behaviour when a caller passes role or ARIA attributes', () => {
    const { container, getByRole } = render(
      <>
        <Alert id="static" {...{ role: 'alert', 'aria-live': 'assertive' }}>
          Static
        </Alert>
        <Alert id="polite" live="polite" {...{ role: 'alert', 'aria-live': 'off' }}>
          Polite
        </Alert>
      </>,
    );
    const staticAlert = container.querySelector('#static');
    expect(staticAlert?.getAttribute('role')).toBeNull();
    expect(staticAlert?.getAttribute('aria-live')).toBeNull();
    expect(getByRole('status').id).toBe('polite');
    expect(getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('passes other attributes to the root element', () => {
    const { getByRole } = render(
      <Alert live="assertive" id="form-error" data-testid="err">
        Oops
      </Alert>,
    );
    expect(getByRole('alert').id).toBe('form-error');
    expect(getByRole('alert').getAttribute('data-testid')).toBe('err');
  });
});
