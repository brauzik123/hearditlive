'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmUsername }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not delete the account.');
      setDeleting(false);
      return;
    }
    router.push('/login');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 text-sm text-muted hover:text-red-400 transition py-2"
      >
        <Trash2 size={14} /> Delete account
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-red-500/5 border border-red-400/40 rounded-lg p-4">
      <p className="text-sm font-bold text-red-400">Delete your account permanently?</p>
      <p className="text-xs text-muted">
        Your profile, every concert, setlist and photo, and all your follows are removed for good. This can&apos;t be
        undone. Type your username to confirm.
      </p>
      <input
        value={confirmUsername}
        onChange={(e) => setConfirmUsername(e.target.value)}
        placeholder="Your username"
        autoComplete="off"
        className="w-full bg-surface-light border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-red-400 transition"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setConfirmUsername('');
            setError('');
          }}
          className="flex-1 bg-surface border border-border rounded-lg py-2 text-sm hover:border-muted transition"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || !confirmUsername.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white rounded-lg py-2 text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {deleting && <Loader2 size={14} className="animate-spin" />}
          Delete forever
        </button>
      </div>
    </div>
  );
}
