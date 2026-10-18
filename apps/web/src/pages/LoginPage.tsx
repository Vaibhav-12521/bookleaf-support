import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@bookleaf/shared';
import { errorMessage } from '../api/client';
import { Logo } from '../components/AppShell';
import { DemoLauncher } from '../components/DemoAccounts';
import { Banner, Button, Card, Field, inputClass } from '../components/ui';
import { useSession } from '../hooks/useSession';
import { homeFor } from '../lib/routes';
import { fieldErrors } from '../lib/validation';

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const user = await login(parsed.data);
      const from = (location.state as { from?: string } | null)?.from;
      const allowed = from && (user.role === 'ADMIN') === from.startsWith('/admin');
      navigate(allowed ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-leaf-100 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Authors and BookLeaf team members use the same sign-in.</p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            {formError && <Banner tone="error">{formError}</Banner>}
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
              />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password}>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
              />
            </Field>
            <Button type="submit" className="w-full" loading={submitting}>
              Sign in
            </Button>
          </form>
        </Card>

      </div>
      <DemoLauncher />
    </div>
  );
}
