'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe, UserCheck, Lock, LogOut, Check, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import DeleteAccountSection from '../../components/DeleteAccountSection';
import LanguageSwitch from '../../components/LanguageSwitch';
import Avatar from '../../components/Avatar';

const PROFILE_VISIBILITY = [
  { value: 'public', icon: Globe },
  { value: 'friends', icon: UserCheck },
  { value: 'private', icon: Lock },
];

export default function Settings() {
  const router = useRouter();
  const { t } = useI18n();

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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, bio, profile_visibility, default_entry_visibility, hide_entry_media_default')
        .eq('id', user.id)
        .single();

      if (profile) {
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
    setError('');
    const trimmed = username.trim();
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(trimmed)) {
      setError(t('settings.usernameInvalid'));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username: trimmed,
        bio: bio.trim() || null,
        profile_visibility: profileVisibility,
        default_entry_visibility: defaultEntryVisibility,
        hide_entry_media_default: hideMediaDefault,
      })
      .eq('id', user.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.code === '23505' ? t('settings.usernameTaken') : t('settings.saveFailed'));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <main className="flex justify-center p-12">
        <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-6 pb-40 md:py-10 md:pb-28">
      <div className="flex flex-col gap-4">
        <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> {t('friends.backToProfile')}
        </Link>
        <h1 className="marquee text-5xl">{t('settings.title')}</h1>
      </div>

      <Section title={t('settings.profile')}>
        <div className="flex items-center gap-4">
          <Avatar username={username} size={64} />
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-muted">{t('settings.username')}</span>
            <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">{t('settings.bio')}</span>
          <textarea
            className="field"
            rows={2}
            maxLength={160}
            placeholder={t('settings.bioPlaceholder')}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
      </Section>

      <Section title={t('settings.language')}>
        <LanguageSwitch />
      </Section>

      <Section title={t('settings.privacy')}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-muted">{t('settings.whoSeesProfile')}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROFILE_VISIBILITY.map(({ value, icon: Icon }) => (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition ${
                  profileVisibility === value ? 'border-brand bg-surface' : 'border-border hover:border-muted'
                }`}
              >
                <input
                  type="radio"
                  name="profile-visibility"
                  value={value}
                  checked={profileVisibility === value}
                  onChange={() => setProfileVisibility(value)}
                  className="sr-only"
                />
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon size={14} className={profileVisibility === value ? 'text-brand' : 'text-muted'} />
                  {t(`visibility.${value}`)}
                </span>
                <span className="text-xs text-muted">{t(`settings.visibilityHint.${value}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">{t('settings.defaultEntryVisibility')}</span>
          <select className="field" value={defaultEntryVisibility} onChange={(e) => setDefaultEntryVisibility(e.target.value)}>
            <option value="public">{t('visibility.public')}</option>
            <option value="friends">{t('visibility.friends')}</option>
            <option value="private">{t('visibility.private')}</option>
          </select>
          <span className="text-xs text-muted">{t('settings.defaultEntryHint')}</span>
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <span className="text-sm">
            {t('settings.hideMedia')}
            <span className="mt-0.5 block text-xs text-muted">{t('settings.hideMediaHint')}</span>
          </span>
          <input
            type="checkbox"
            checked={hideMediaDefault}
            onChange={(e) => setHideMediaDefault(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-brand"
          />
        </label>
      </Section>

      <Section title={t('settings.account')}>
        <p className="-mt-1 text-sm text-muted">{email}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/reset-password"
            className="flex flex-1 items-center justify-center rounded-full border border-border py-2.5 text-sm font-medium transition hover:border-brand"
          >
            {t('settings.changePassword')}
          </Link>
          <button
            onClick={handleSignOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium transition hover:border-danger hover:text-danger"
          >
            <LogOut size={15} /> {t('settings.signOut')}
          </button>
        </div>
        <DeleteAccountSection />
      </Section>

      <div className="fixed bottom-16 left-0 z-40 w-full border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {error && (
            <p role="alert" className="flex-1 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto flex min-w-40 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 font-bold text-brand-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {!saving && saved && <Check size={16} />}
            {saved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="marquee text-3xl">{title}</h2>
      {children}
    </section>
  );
}
