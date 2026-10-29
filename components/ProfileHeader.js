'use client';

import Link from 'next/link';
import Avatar from './Avatar';
import { useI18n } from '../i18n/client';

// Shared by your own profile and other people's: monogram, name, bio and
// the three counts. `action` sits beside the name (settings link, follow
// button…).
// `links` (optional) makes the numbers tappable: { shows, followers, following } hrefs.
export default function ProfileHeader({ username, avatarUrl, bio, followers, following, shows, action, links = {} }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar username={username} src={avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="marquee truncate text-5xl">{username}</h1>
          {/* overflow-wrap: anywhere, so a long unbroken word wraps instead of pushing past the edge. */}
          {bio && <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{bio}</p>}
        </div>
        {action}
      </div>
      <div className="flex gap-8">
        {[
          [shows, t('profile.shows', { count: shows ?? 0 }), links.shows],
          [followers, t('profile.followers', { count: followers ?? 0 }), links.followers],
          [following, t('profile.following', { count: following ?? 0 }), links.following],
        ]
          .filter(([value]) => value != null)
          .map(([value, label, href]) => {
            const content = (
              <>
                <span className="order-2 text-sm text-muted group-hover:text-foreground">{label}</span>
                <span className="marquee order-1 text-3xl group-hover:text-brand">{value}</span>
              </>
            );
            return href ? (
              <Link key={label} href={href} className="group flex flex-col">
                {content}
              </Link>
            ) : (
              <div key={label} className="flex flex-col">
                {content}
              </div>
            );
          })}
      </div>
    </section>
  );
}
