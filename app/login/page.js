'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User as UserIcon, Apple, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const isLogin = mode === 'login';
  const router = useRouter();
  const supabase = createClient();

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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push('/');
      router.refresh();
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        router.push('/');
        router.refresh();
      } else {
        setInfo('Check your email to confirm your account, then log in.');
        setMode('login');
      }
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Heard<span className="text-brand">It</span>Live
          </h1>
          <p className="text-muted text-sm mt-2">Your personal concert logbook</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6">
          {!isLogin && (
            <Field icon={UserIcon} type="text" placeholder="Username" value={username} onChange={setUsername} required />
          )}
          <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} required />
          <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} required />
          {!isLogin && (
            <Field icon={Lock} type="password" placeholder="Confirm password" value={confirmPassword} onChange={setConfirmPassword} required />
          )}

          {isLogin && (
            <button type="button" className="text-xs text-muted hover:text-foreground transition self-end -mt-1">
              Forgot your password?
            </button>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          {info && <p className="text-xs text-brand">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-brand text-brand-foreground font-bold rounded-full py-2.5 mt-1 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? 'Log In' : 'Create Account'}
          </button>

          <div className="flex items-center gap-3 my-1">
            <hr className="flex-1 border-border" />
            <span className="text-xs text-muted">or continue with</span>
            <hr className="flex-1 border-border" />
          </div>

          <button
            type="button"
            disabled
            title="Coming soon — requires Apple Sign In configuration"
            className="flex items-center justify-center gap-2 bg-surface-light border border-border rounded-full py-2.5 text-sm font-medium text-muted cursor-not-allowed"
          >
            <Apple size={16} /> Sign in with Apple
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 bg-surface-light border border-border rounded-full py-2.5 text-sm font-medium hover:border-muted transition"
          >
            <GoogleIcon /> Sign in with Google
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => switchMode(isLogin ? 'register' : 'login')} className="text-brand font-medium">
            {isLogin ? 'Register here' : 'Log in'}
          </button>
        </p>
      </div>
    </main>
  );
}

function Field({ icon: Icon, value, onChange, ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-light border border-border rounded-lg py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-brand transition"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.59-5.17 3.59-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.24 21.3 7.29 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 010-4.54v-3.1H1.27a12 12 0 000 10.74l4-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.29 0 3.24 2.7 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}
