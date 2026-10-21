'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';
import Avatar from './Avatar';
import { shrinkImage } from '../utils/image';

export default function AvatarEditor({ username, avatarUrl, onChange }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Removes every file in the user's folder except `keep`.
  const clearOld = async (supabase, userId, keep) => {
    const { data: files } = await supabase.storage.from('avatars').list(userId);
    const stale = (files ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
    if (stale.length) await supabase.storage.from('avatars').remove(stale);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      let blob;
      try {
        blob = await shrinkImage(file, { maxSide: 512, square: true, quality: 0.86 });
      } catch {
        // Typically HEIC photos in browsers that can't decode them.
        setError(t('settings.photoUnsupported'));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // A new file name per upload, so browsers don't keep showing a cached
      // old photo under the same URL.
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      await clearOld(supabase, user.id, path);
      onChange(publicUrl);
    } catch {
      setError(t('settings.photoFailed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError('');
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      if (updateError) throw updateError;
      await clearOld(supabase, user.id, null);
      onChange(null);
    } catch {
      setError(t('settings.photoFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={t('settings.photoChange')}
        className="group relative shrink-0 rounded-full"
      >
        <Avatar username={username} src={avatarUrl} size={80} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera size={20} />
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 size={20} className="animate-spin" />
          </span>
        )}
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-brand disabled:opacity-60"
        >
          <Camera size={14} /> {avatarUrl ? t('settings.photoChange') : t('settings.photoAdd')}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm text-muted transition hover:text-danger disabled:opacity-60"
          >
            <Trash2 size={13} /> {t('settings.photoRemove')}
          </button>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
