import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { TenantConfig } from '@shared/types';

export interface UseAuthReturn {
  isAuthed: Signal<boolean>;
  isLoading: Signal<boolean>;
  showExpiredBanner: Signal<boolean>;
  tenantConfig: Signal<TenantConfig | null>;
  token: Signal<string | null>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const isAuthed = useSignal(false);
  const isLoading = useSignal(true);
  const showExpiredBanner = useSignal(false);
  const tenantConfig = useSignal<TenantConfig | null>(null);
  const token = useSignal<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('admin_token');
    if (!raw) {
      isLoading.value = false;
      isAuthed.value = false;
      return;
    }
    try {
      const payload = JSON.parse(atob(raw.split('.')[1])) as { exp?: number };
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin_tenant');
        showExpiredBanner.value = true;
        isAuthed.value = false;
        isLoading.value = false;
        return;
      }
    } catch {
      isAuthed.value = false;
      isLoading.value = false;
      return;
    }
    const tenantRaw = sessionStorage.getItem('admin_tenant');
    if (tenantRaw) {
      try {
        tenantConfig.value = JSON.parse(tenantRaw) as TenantConfig;
      } catch {
        /* ignore malformed */
      }
    }
    token.value = raw;
    isAuthed.value = true;
    isLoading.value = false;
  }, []);

  async function login(email: string, password: string): Promise<{ error?: string }> {
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (r.ok) {
        const body = (await r.json()) as { data: { token: string; tenant: TenantConfig } };
        const data = body.data;
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_tenant', JSON.stringify(data.tenant));
        tenantConfig.value = data.tenant;
        token.value = data.token;
        isAuthed.value = true;
        return {};
      }
      if (r.status === 401) return { error: 'Invalid email or password.' };
      if (r.status === 429) return { error: 'Too many failed attempts. Please try again later.' };
      return { error: 'Something went wrong. Please try again.' };
    } catch {
      return { error: 'Unable to connect. Please check your connection.' };
    }
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_tenant');
    token.value = null;
    tenantConfig.value = null;
    isAuthed.value = false;
  }

  return { isAuthed, isLoading, showExpiredBanner, tenantConfig, token, login, logout };
}
