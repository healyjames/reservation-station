// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { describe, expect, it, vi } from 'vitest';
import type { TenantConfig } from '@shared/types';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import Login from './Login';

function makeAuth(overrides: Partial<UseAuthReturn> = {}): UseAuthReturn {
  return {
    isAuthed: signal(false),
    isLoading: signal(false),
    showExpiredBanner: signal(false),
    tenantConfig: signal<TenantConfig | null>(null),
    token: signal<string | null>(null),
    login: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    ...overrides,
  };
}

function fill(getByLabelText: (text: string) => HTMLElement, email: string, password: string) {
  fireEvent.input(getByLabelText('Email address'), { target: { value: email } });
  fireEvent.input(getByLabelText('Password'), { target: { value: password } });
}

describe('Login', () => {
  it('is a sign-in region with labelled, required email and password fields', () => {
    const { getByRole, getByLabelText } = render(<Login auth={makeAuth()} onLoginSuccess={vi.fn()} />);
    expect(getByRole('region', { name: 'Staff Sign In' })).toBeTruthy();
    const email = getByLabelText('Email address') as HTMLInputElement;
    const password = getByLabelText('Password') as HTMLInputElement;
    expect([email.type, email.autocomplete, email.required]).toEqual(['email', 'username', true]);
    expect([password.type, password.autocomplete, password.required]).toEqual(['password', 'current-password', true]);
  });

  it('asks for both fields before signing in', async () => {
    const auth = makeAuth();
    const { getByRole } = render(<Login auth={auth} onLoginSuccess={vi.fn()} />);
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Sign in' }));
    });
    expect(getByRole('alert').textContent).toBe('Please enter your email and password.');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and reports success', async () => {
    const auth = makeAuth();
    const onLoginSuccess = vi.fn();
    const { getByRole, getByLabelText } = render(<Login auth={auth} onLoginSuccess={onLoginSuccess} />);
    fill(getByLabelText, '  staff@example.com ', 'secret');
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Sign in' }));
    });
    expect(auth.login).toHaveBeenCalledWith('staff@example.com', 'secret');
    expect(onLoginSuccess).toHaveBeenCalledOnce();
  });

  it('is busy while signing in', async () => {
    let finish: (value: { error?: string }) => void = () => {};
    const auth = makeAuth({ login: vi.fn(() => new Promise<{ error?: string }>((resolve) => (finish = resolve))) });
    const { getByRole, getByLabelText } = render(<Login auth={auth} onLoginSuccess={vi.fn()} />);
    fill(getByLabelText, 'staff@example.com', 'secret');
    fireEvent.click(getByRole('button', { name: 'Sign in' }));

    const busy = getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await act(async () => finish({}));
  });

  it('announces a failed sign-in assertively', async () => {
    const auth = makeAuth({ login: vi.fn().mockResolvedValue({ error: 'Invalid credentials' }) });
    const onLoginSuccess = vi.fn();
    const { getByRole, getByLabelText } = render(<Login auth={auth} onLoginSuccess={onLoginSuccess} />);
    fill(getByLabelText, 'staff@example.com', 'wrong');
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Sign in' }));
    });
    const alert = getByRole('alert');
    expect(alert.textContent).toBe('Invalid credentials');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('tells a returning user their session expired, politely', () => {
    const { getByRole } = render(<Login auth={makeAuth({ showExpiredBanner: signal(true) })} onLoginSuccess={vi.fn()} />);
    const status = getByRole('status');
    expect(status.textContent).toBe('Your session has expired. Please sign in again.');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('shows no expired-session message by default', () => {
    const { queryByRole } = render(<Login auth={makeAuth()} onLoginSuccess={vi.fn()} />);
    expect(queryByRole('status')).toBeNull();
  });

  it('clears a previous error when signing in again', async () => {
    const login = vi.fn().mockResolvedValueOnce({ error: 'Invalid credentials' }).mockResolvedValueOnce({});
    const { getByRole, getByLabelText, queryByRole } = render(<Login auth={makeAuth({ login })} onLoginSuccess={vi.fn()} />);
    fill(getByLabelText, 'staff@example.com', 'wrong');
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Sign in' }));
    });
    expect(getByRole('alert')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Sign in' }));
    });
    expect(queryByRole('alert')).toBeNull();
  });

  it('keeps the brand panel hidden from assistive tech', () => {
    const { container } = render(<Login auth={makeAuth()} onLoginSuccess={vi.fn()} />);
    expect(container.querySelector('aside')?.getAttribute('aria-hidden')).toBe('true');
  });
});
