/**
 * AdminAuth - client-side auth utilities for the admin dashboard.
 * Attach to window as a global (no bundler).
 *
 * Storage keys:
 *   admin_token   - raw JWT string
 *   admin_tenant  - JSON-encoded tenant object
 */
const AdminAuth = (() => {
  const TOKEN_KEY  = 'admin_token';
  const TENANT_KEY = 'admin_tenant';
  const API_LOGIN  = '/api/auth/login';
  const ADMIN_ROOT = '/admin/';

  /**
   * POST /api/auth/login with { email, password }.
   * Returns parsed JSON response body on success.
   * Throws an error with a `status` property on HTTP errors.
   */
  async function login(email, password) {
    const res = await fetch(API_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(body.message || 'Login failed');
      err.status = res.status;
      throw err;
    }

    return body.data;
  }

  /**
   * Clear auth state and redirect to the login page.
   */
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    window.location.href = ADMIN_ROOT;
  }

  /**
   * Returns the stored JWT string, or null if not present.
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Returns the stored tenant object, or null if not present.
   */
  function getTenant() {
    const raw = localStorage.getItem(TENANT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Guard for protected pages. Call at the top of each dashboard page.
   * If no token is found, redirects to /admin/?expired=1 so the login
   * page can show a "session expired" message.
   */
  function requireAuth() {
    if (!getToken()) {
      window.location.href = `${ADMIN_ROOT}?expired=1`;
    }
  }

  return { login, logout, getToken, getTenant, requireAuth };
})();

window.AdminAuth = AdminAuth;
