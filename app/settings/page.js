'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, User as UserIcon, Camera, Globe, UserCheck, Lock,
  EyeOff, LogOut, Check, Loader2,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

const inputClass =
  'bg-surface border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-brand transition w-full';

const visibilityOptions = [
  { value: 'public', label: 'Public', icon: Globe, hint: 'Anyone can view' },
  { value: 'friends', label: 'Friends only', icon: UserCheck, hint: 'Only mutual follows' },
  { value: 'private', label: 'Private', icon: Lock, hint: 'Only you' },
];

export default function Settings() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [defaultEntryVisibility, setDefaultEntryVisibility] = useState('public');
  const [hideMediaDefault, setHideMediaDefault] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('username, bio, profile_visibility, default_entry_visibility, hide_entry_media_default')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else if (profile) {
        setUsername(profile.username ?? '');
        setBio(profile.bio ?? '');
        setProfileVisibility(profile.profile_visibility ?? 'public');
        setDefaultEntryVisibility(profile.default_entry_visibility ?? 'public');
        setHideMediaDefault(!!profile.hide_entry_media_default);
      }

      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        bio,
        profile_visibility: profileVisibility,
        default_entry_visibility: defaultEntryVisibility,
        hide_entry_media_default: hideMediaDefault,
      })
      .eq('id', user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" />
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-8 pb-40 md:pb-28">
      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
        <ArrowLeft size={16} /> Back to profile
      </Link>

      <h1 className="text-2xl font-bold">Settings</h1>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Profile info */}
      <section className="flex flex-col gap-4">
        <h2 className="font-bold text-lg">Profile</h2>

        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center">
              <UserIcon size={28} className="text-muted" />
            </div>
            <button
              disabled
              title="Avatar upload coming soon"
              className="absolute -bottom-1 -right-1 bg-brand text-brand-foreground rounded-full p-1.5 opacity-60 cursor-not-allowed"
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Username</span>
              <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Bio</span>
          <textarea className={inputClass} rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
      </section>

      <hr className="border-border" />

      {/* Privacy */}
      <section className="flex flex-col gap-4">
        <h2 className="font-bold text-lg">Privacy</h2>

        <div>
          <p className="text-sm text-muted mb-2">Who can see your profile</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {visibilityOptions.map(({ value, label, icon: Icon, hint }) => (
              <button
                key={value}
                onClick={() => setProfileVisibility(value)}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition ${
                  profileVisibility === value ? 'border-brand bg-surface-light' : 'border-border bg-surface hover:border-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium text-sm"><Icon size={14} /> {label}</span>
                <span className="text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Default visibility for new entries</p>
          <select
            className={inputClass}
            value={defaultEntryVisibility}
            onChange={(e) => setDefaultEntryVisibility(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="friends">Friends only</option>
            <option value="private">Only me</option>
          </select>
          <p className="text-xs text-muted mt-1.5">You can still override this per entry when logging a concert.</p>
        </div>

        <label className="flex items-center justify-between gap-4 bg-surface border border-border rounded-lg px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <EyeOff size={16} className="text-muted" /> Hide photos &amp; descriptions by default
          </span>
          <input
            type="checkbox"
            checked={hideMediaDefault}
            onChange={(e) => setHideMediaDefault(e.target.checked)}
            className="accent-brand w-4 h-4"
          />
        </label>
      </section>

      <hr className="border-border" />

      {/* Account */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-lg">Account</h2>
        <p className="text-xs text-muted -mt-1">{email}</p>
        <Link
          href="/reset-password"
          className="flex items-center justify-center gap-2 bg-surface border border-border rounded-lg py-2.5 text-sm font-medium hover:border-muted transition"
        >
          Change password
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 bg-surface border border-border rounded-lg py-2.5 text-sm font-medium text-red-400 hover:border-red-400 transition"
        >
          <LogOut size={16} /> Sign out
        </button>
      </section>

      <div className="fixed bottom-16 md:bottom-0 left-0 w-full bg-background border-t border-border p-3">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-brand text-brand-foreground rounded-full py-3 font-bold hover:opacity-90 transition disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {!saving && saved && <><Check size={16} /> Saved</>}
            {!saving && !saved && 'Save Changes'}
          </button>
        </div>
      </div>
    </main>
  );
}
