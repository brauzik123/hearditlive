'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Plus, UserPlus } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import Avatar from '../../../components/Avatar';
import FriendShowRow from './FriendShowRow';
import PeopleSheet from './PeopleSheet';

// The Friends page: your friends at a glance, then where the people you
// follow are going and have been, by concert date. Everything about adding
// people lives in a separate panel (PeopleSheet), out of the way.
export default function FriendsView({ upcoming, recent, friends, hasFollows, pendingRequests }) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState(null); // null, or the tab to open on
  const [requestCount, setRequestCount] = useState(pendingRequests);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openSheet = (tab) => setSheet(tab ?? (requestCount > 0 ? 'requests' : 'find'));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="marquee text-5xl">{t('friends.title')}</h1>
        <button
          type="button"
          onClick={() => openSheet()}
          className="relative flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-brand"
        >
          <UserPlus size={16} /> {t('friends.addPeople')}
          {requestCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground"
              aria-label={t('nav.requests', { count: requestCount })}
            >
              {requestCount}
            </span>
          )}
        </button>
      </header>

      {friends.length > 0 && (
        <ul className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-1" aria-label={t('friends.tabs.friends')}>
          {friends.map((f) => (
            <li key={f.id} className="shrink-0">
              <Link href={`/u/${f.username}`} className="flex w-16 flex-col items-center gap-1.5">
                <Avatar username={f.username} src={f.avatar_url} size={56} />
                <span className="w-full truncate text-center text-xs text-muted">{f.username}</span>
              </Link>
            </li>
          ))}
          <li className="shrink-0">
            <button type="button" onClick={() => openSheet('find')} className="flex w-16 flex-col items-center gap-1.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border text-muted transition hover:border-brand hover:text-foreground">
                <Plus size={22} />
              </span>
              <span className="w-full truncate text-center text-xs text-muted">{t('common.add')}</span>
            </button>
          </li>
        </ul>
      )}

      {!hasFollows ? (
        <section className="flex flex-col items-start gap-4 rounded-2xl bg-paper p-6 text-paper-ink">
          <p className="marquee text-3xl leading-tight">{t('friends.emptyTitle')}</p>
          <p className="max-w-sm text-sm text-paper-muted">{t('friends.emptyBody')}</p>
          <button
            type="button"
            onClick={() => openSheet('find')}
            className="flex items-center gap-2 rounded-full bg-paper-ink px-4 py-2 text-sm font-bold text-paper"
          >
            <UserPlus size={16} /> {t('friends.addPeople')}
          </button>
        </section>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="friends-upcoming">
              <h2 id="friends-upcoming" className="marquee text-3xl">
                {t('friends.comingUp')}
              </h2>
              <ul className="flex flex-col gap-3">
                {upcoming.map((show) => (
                  <FriendShowRow key={show.key} show={show} upcoming />
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="friends-recent">
            <h2 id="friends-recent" className="marquee text-3xl">
              {t('friends.recently')}
            </h2>
            {recent.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
                {t('friends.noShowsYet')}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recent.map((show) => (
                  <FriendShowRow key={show.key} show={show} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <PeopleSheet open={sheet !== null} initialTab={sheet ?? 'find'} onClose={closeSheet} onRequestsChange={setRequestCount} />
    </main>
  );
}
