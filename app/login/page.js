'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import LanguageSwitch from '../../components/LanguageSwitch';

// Supabase reports errors in English; map the ones people actually hit.
function authErrorKey(error) {
  if (error.code === 'invalid_credentials') return 'login.errors.invalidCredentials';
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return 'login.errors.emailTaken';
  if (error.code === 'weak_password') return 'login.errors.weakPassword';
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) return 'login.errors.rateLimited';
  if (error.code === 'email_not_confirmed') return 'login.errors.notConfirmed';
  // The profile insert trigger fails when the chosen username is taken.
  if (error.message?.includes('Database error saving new user')) return 'login.errors.usernameTaken';
  return 'login.errors.generic';
}

export default function Login() {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const isLogin = mode === 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  // The emailed link signs the user in via /auth/callback, which then
  // forwards to /reset-password to choose a new one.
  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError(t('login.forgotNeedsEmail'));
      return;
    }
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) {
      setError(t(authErrorKey(resetError)));
      return;
    }
    setInfo(t('login.forgotSent'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!isLogin) {
      if (!/^[A-Za-z0-9_.]{3,30}$/.test(username.trim())) {
        setError(t('settings.usernameInvalid'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('login.errors.passwordsDiffer'));
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(t(authErrorKey(signInError)));
        return;
      }
      router.push('/');
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });
    setLoading(false);
    if (signUpError) {
      setError(t(authErrorKey(signUpError)));
      return;
    }
    if (data.session) {
      router.push('/');
      router.refresh();
    } else {
      setInfo(t('login.checkEmail'));
      setMode('login');
    }
  };

  return (
    <main className="flex min-h-screen flex-col px-5 py-6">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-10">
        <div>
          <p className="marquee text-[5.5rem] leading-[0.85] sm:text-8xl">
            Heard
            <br />
            It Live
          </p>
          <p className="mt-4 text-muted">{t('login.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold">{isLogin ? t('login.loginTitle') : t('login.registerTitle')}</h1>
          {!isLogin && (
            <Field label={t('settings.username')} type="text" autoComplete="username" value={username} onChange={setUsername} />
          )}
          <Field label={t('login.email')} type="email" autoComplete="email" value={email} onChange={setEmail} />
          <Field
            label={t('login.password')}
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={setPassword}
          />
          {!isLogin && (
            <Field
              label={t('login.confirmPassword')}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          )}

          {isLogin && (
            <button type="button" onClick={handleForgotPassword} className="self-start text-sm text-muted hover:text-foreground">
              {t('login.forgot')}
            </button>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-brand">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-full bg-brand py-3 font-bold text-brand-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? t('login.loginButton') : t('login.registerButton')}
          </button>

          <div className="my-2 flex items-center gap-3 text-xs text-muted">
            <hr className="flex-1 border-border" />
            {t('login.or')}
            <hr className="flex-1 border-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium transition hover:border-muted"
          >
            <GoogleIcon /> {t('login.google')}
          </button>
        </form>

        <p className="text-sm text-muted">
          {isLogin ? t('login.noAccount') : t('login.haveAccount')}{' '}
          <button onClick={() => switchMode(isLogin ? 'register' : 'login')} className="font-semibold text-brand">
            {isLogin ? t('login.registerLink') : t('login.loginLink')}
          </button>
        </p>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <input {...props} required value={value} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.24 21.3 7.29 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 010-4.54v-3.1H1.27a12 12 0 000 10.74l4-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.29 0 3.24 2.7 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}
