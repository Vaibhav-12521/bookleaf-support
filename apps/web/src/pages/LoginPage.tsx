import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@bookleaf/shared';
import { errorMessage } from '../api/client';
import { Logo } from '../components/AppShell';
import { DEMO_ENABLED, DemoLauncher } from '../components/DemoAccounts';
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
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden bg-brand-700 px-12 py-12 text-white lg:flex lg:flex-col xl:px-16">
        <div className="relative">
          <Logo tone="light" />
        </div>
        <div className="relative my-auto max-w-xl py-12">
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-brand-200 uppercase">Author Support &amp; Communication Portal</p>
          <p className="font-display text-4xl leading-tight font-medium xl:text-5xl">
            Every author question, answered <span className="text-brand-200">well</span>, and on time.
          </p>
          <ul className="mt-10 space-y-5 text-sm text-brand-100/85">
            {[
              ['Royalties, ISBNs, printing, distribution', 'One place for authors to see their books and raise a question.'],
              ['Triaged the moment it arrives', 'Every ticket is categorised and prioritised, so urgent issues surface first.'],
              ['Replies grounded in BookLeaf policy', 'AI drafts use the author’s real figures; the team reviews every reply.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-leaf-500" />
                <span>
                  <span className="block font-medium text-white">{title}</span>
                  {body}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
          {[
            ['22,000+', 'titles in the catalogue'],
            ['1,200+', 'books published monthly'],
            ['India & US', 'authors we work with'],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-2xl text-white">{value}</dd>
              <dd className="mt-1 text-xs text-brand-100/70">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col justify-center bg-paper px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-semibold text-brand-700 sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Authors and BookLeaf team members use the same sign-in.</p>
          <Card className="mt-8 p-6 sm:p-8">
            <form className="space-y-5" onSubmit={submit} noValidate>
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
              <Button type="submit" className="w-full py-2.5" loading={submitting}>
                Sign in
              </Button>
            </form>
          </Card>
          {DEMO_ENABLED && (
            <p className="mt-6 text-center text-xs text-slate-500 lg:text-left">Reviewing the demo? Use the button at the bottom-right.</p>
          )}
        </div>
      </section>
      <DemoLauncher />
    </div>
  );
}
