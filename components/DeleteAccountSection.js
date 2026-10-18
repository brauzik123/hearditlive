'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/client';

export default function DeleteAccountSection() {
  const router = useRouter();
  const { t } = useI18n();
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
      setError(res.status === 400 ? t('settings.deleteMismatch') : t('settings.deleteFailed'));
      setDeleting(false);
      return;
    }
    router.push('/login');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 text-sm text-muted hover:text-danger transition py-2"
      >
        <Trash2 size={14} /> {t('settings.deleteAccount')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-danger/5 border border-danger/40 rounded-lg p-4">
      <p className="text-sm font-bold text-danger">{t('settings.deleteTitle')}</p>
      <p className="text-xs text-muted">
        {t('settings.deleteBody')}
      </p>
      <input
        value={confirmUsername}
        onChange={(e) => setConfirmUsername(e.target.value)}
        placeholder={t('settings.deletePlaceholder')}
        autoComplete="off"
        className="w-full bg-surface-light border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-danger transition"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setConfirmUsername('');
            setError('');
          }}
          className="flex-1 bg-surface border border-border rounded-lg py-2 text-sm hover:border-muted transition"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || !confirmUsername.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-danger text-paper-ink rounded-lg py-2 text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {deleting && <Loader2 size={14} className="animate-spin" />}
          {t('settings.deleteForever')}
        </button>
      </div>
    </div>
  );
}
