import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { TenantConfig } from '@shared/types';
import { useEffect } from 'preact/hooks';

type TenantState = 'loading' | 'ready' | 'error';

type UseTenantReturn = {
  tenantConfig: Signal<TenantConfig | null>;
  tenantState: Signal<TenantState>;
  tenantError: Signal<string>;
}

export function useTenant(): UseTenantReturn {
  const tenantConfig = useSignal<TenantConfig | null>(null);
  const tenantState = useSignal<TenantState>('loading');
  const tenantError = useSignal('');

  useEffect(() => {
    const tenantId = new URLSearchParams(window.location.search).get('tenant');
    if (!tenantId) {
      tenantError.value = 'Unable to load booking configuration. Please check the URL and try again.';
      tenantState.value = 'error';
      return;
    }

    fetch(`/api/tenants/${encodeURIComponent(tenantId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<TenantConfig>;
      })
      .then((config) => {
        tenantConfig.value = config;
        tenantState.value = 'ready';
      })
      .catch((e: Error) => {
        tenantError.value = 'Unable to load booking configuration. Please check the URL and try again.';
        tenantState.value = 'error';
        console.error('[booking-widget] Failed to load tenant:', e.message);
      });
  }, []);

  return { tenantConfig, tenantState, tenantError };
}
