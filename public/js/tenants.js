// Tenant config - loaded once on page init and shared across modules
export let tenantConfig = null;

export async function loadTenant() {
  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenant');

  if (!tenantId) {
    console.warn('[ReservationStation] No ?tenant= param in URL - some features will be unavailable.');
    return null;
  }

  try {
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    tenantConfig = await res.json();
    return tenantConfig;
  } catch (e) {
    console.error('[ReservationStation] Failed to load tenant config:', e.message);
    return null;
  }
}
