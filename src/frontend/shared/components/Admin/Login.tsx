import { useSignal } from '@preact/signals';
import type { FunctionComponent } from 'preact';
import type { UseAuthReturn } from '@shared/hooks/useAuth';
import { Alert, Button, Card, Fieldset, Input } from '@shared/components/ui';
import BrandMark from './BrandMark';

type LoginProps = {
  auth: UseAuthReturn;
  onLoginSuccess: () => void;
};

/** Staff sign-in: the form on the left, a decorative brand panel on the right from md up. */
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
    <div class="grid min-h-screen md:grid-cols-2">
      <main class="bg-base-100 flex items-center justify-center p-8">
        <Card as="section" aria-labelledby="login-title" class="w-full max-w-[360px] [--card-p:0]">
          <div class="grid gap-6">
            <header class="grid justify-items-center gap-3 text-center">
              <div class="bg-base-300 text-primary flex size-12 items-center justify-center rounded-full">
                <BrandMark class="size-6" />
              </div>
              <h1 id="login-title" class="m-0 text-2xl font-bold">
                Staff Sign In
              </h1>
              <p class="text-base-content/70 m-0 text-sm">Maximum Bookings Admin</p>
            </header>

            {auth.showExpiredBanner.value && (
              <Alert variant="info" live="polite">
                Your session has expired. Please sign in again.
              </Alert>
            )}

            {errorMessage.value && (
              <Alert variant="error" live="assertive">
                {errorMessage.value}
              </Alert>
            )}

            <form class="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
              <Fieldset label="Email address" required>
                <Input
                  type="email"
                  id="login-email"
                  name="email"
                  autocomplete="username"
                  required
                  placeholder="you@example.com"
                  value={email.value}
                  onInput={(e) => {
                    email.value = (e.target as HTMLInputElement).value;
                  }}
                />
              </Fieldset>
              <Fieldset label="Password" required>
                <Input
                  type="password"
                  id="login-password"
                  name="password"
                  autocomplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password.value}
                  onInput={(e) => {
                    password.value = (e.target as HTMLInputElement).value;
                  }}
                />
              </Fieldset>
              <Button type="submit" variant="primary" block isLoading={isSubmitting.value}>
                {isSubmitting.value ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <footer class="text-base-content/70 text-center text-[0.8rem]">
              <p class="m-0">Staff access only. Not a member? Contact your manager.</p>
            </footer>
          </div>
        </Card>
      </main>
      <aside class="from-base-300 to-primary/40 hidden bg-linear-135 md:block" aria-hidden="true" />
    </div>
  );
};

export default Login;
