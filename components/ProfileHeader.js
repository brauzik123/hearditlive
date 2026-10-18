'use client';

import Avatar from './Avatar';
import { useI18n } from '../i18n/client';

// Shared by your own profile and other people's: monogram, name, bio and
// the three counts. `action` sits beside the name (settings link, follow
// button…).
export default function ProfileHeader({ username, bio, followers, following, shows, action }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar username={username} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="marquee truncate text-5xl">{username}</h1>
          {bio && <p className="mt-1 text-sm text-muted">{bio}</p>}
        </div>
        {action}
      </div>
      <dl className="flex gap-8">
        {[
          [shows, t('profile.shows', { count: shows ?? 0 })],
          [followers, t('profile.followers', { count: followers ?? 0 })],
          [following, t('profile.following', { count: following ?? 0 })],
        ]
          .filter(([value]) => value != null)
          .map(([value, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="order-2 text-sm text-muted">{label}</dt>
              <dd className="marquee order-1 text-3xl">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
