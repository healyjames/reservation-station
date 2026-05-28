import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import { FormField, Input } from '@shared/components';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import styles from './Login.module.css';

interface LoginProps {
  auth: UseAuthReturn;
  onLoginSuccess: () => void;
}

const Login: FunctionComponent<LoginProps> = ({ auth, onLoginSuccess }) => {
  const email = useSignal('');
  const password = useSignal('');
  const errorMessage = useSignal('');
  const isSubmitting = useSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email.value.trim() || !password.value) {
      errorMessage.value = 'Please enter your email and password.';
      return;
    }
    errorMessage.value = '';
    isSubmitting.value = true;
    const result = await auth.login(email.value.trim(), password.value);
    isSubmitting.value = false;
    if (result.error) {
      errorMessage.value = result.error;
      return;
    }
    onLoginSuccess();
  }

  return (
    <div class={styles.login_layout}>
      <main class={styles.login_panel} role="main">
        <div class={styles.login_panel_inner}>
          <header class={styles.login_header}>
            <div class={styles.login_logo} aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <h1>Staff Sign In</h1>
            <p>Maximum Bookings Admin</p>
          </header>

          {auth.showExpiredBanner.value && (
            <div class={`${styles.alert} ${styles.alert_info}`} role="status">
              Your session has expired. Please sign in again.
            </div>
          )}

          {errorMessage.value && (
            <div class={`${styles.alert} ${styles.alert_error}`} role="alert" aria-live="assertive">
              {errorMessage.value}
            </div>
          )}

          <form class="stack" noValidate onSubmit={handleSubmit}>
            <FormField label="Email address" htmlFor="login-email" required>
              <Input
                type="email"
                id="login-email"
                name="email"
                autocomplete="username"
                required
                placeholder="you@example.com"
                value={email.value}
                onInput={(e) => { email.value = (e.target as HTMLInputElement).value; }}
              />
            </FormField>
            <FormField label="Password" htmlFor="login-password" required>
              <Input
                type="password"
                id="login-password"
                name="password"
                autocomplete="current-password"
                required
                placeholder="••••••••"
                value={password.value}
                onInput={(e) => { password.value = (e.target as HTMLInputElement).value; }}
              />
            </FormField>
            <button type="submit" class={`${styles.btn_primary}${isSubmitting.value ? ` ${styles.loading}` : ''}`} disabled={isSubmitting.value}>
              {isSubmitting.value ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <footer class={styles.login_footer}>
            <p>Staff access only. Not a member? Contact your manager.</p>
          </footer>
        </div>
      </main>
      <aside class={styles.login_brand} aria-hidden="true" />
    </div>
  );
};

export default Login;
