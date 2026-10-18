'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

// Reached from the password-reset email (signed in by /auth/callback) or
// from Settings → Change password.
export default function ResetPassword() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push('/');
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="text-muted text-sm mt-2">You&apos;ll use it the next time you log in.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6">
          <PasswordField placeholder="New password" value={password} onChange={setPassword} />
          <PasswordField placeholder="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-brand text-brand-foreground font-bold rounded-full py-2.5 mt-1 hover:opacity-90 transition disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save password
          </button>
        </form>
      </div>
    </main>
  );
}

function PasswordField({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
      <input
        type="password"
        required
        autoComplete="new-password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-light border border-border rounded-lg py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-brand transition"
      />
    </div>
  );
}
