'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';

// Reached from the password-reset email (signed in by /auth/callback) or
// from Settings → Change password.
export default function ResetPassword() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('reset.tooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('login.errors.passwordsDiffer'));
      return;
    }
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.code === 'same_password' ? t('reset.samePassword') : t('login.errors.generic'));
      return;
    }
    router.push('/');
  };

  return (
    <main className="flex min-h-screen flex-col px-5 py-6">
      <Link href="/settings" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> {t('reset.back')}
      </Link>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
        <div>
          <h1 className="marquee text-5xl">{t('reset.title')}</h1>
          <p className="mt-2 text-muted">{t('reset.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <PasswordField label={t('reset.newPassword')} value={password} onChange={setPassword} />
          <PasswordField label={t('reset.confirm')} value={confirmPassword} onChange={setConfirmPassword} />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-1 flex items-center justify-center gap-2 rounded-full bg-brand py-3 font-bold text-brand-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t('reset.save')}
          </button>
        </form>
      </div>
    </main>
  );
}

function PasswordField({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type="password"
        required
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      />
    </label>
  );
}
