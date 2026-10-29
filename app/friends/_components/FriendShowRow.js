'use client';

import Link from 'next/link';
import { useI18n } from '../../../i18n/client';
import Avatar from '../../../components/Avatar';
import { cityName } from '../../../utils/placeNames';

// One concert on the friends timeline: the date as a torn-off paper stub on
// the left, then the artist, the venue and who of your friends was (or is
// going to be) there. Rows come from utils/friendShows.js.
export default function FriendShowRow({ show, upcoming = false }) {
  const { t, locale, stub, ago } = useI18n();
  const date = show.date ? stub(show.date) : null;
  const place = [show.venues?.name, cityName(show.venues, locale)].filter(Boolean).join(', ');
  const [a, b] = show.people.map((p) => p.username);
  const names =
    show.people.length <= 1
      ? a
      : show.people.length === 2
        ? t('friends.twoNames', { a, b })
        : t('friends.manyNames', { a, b, count: show.people.length - 2 });

  return (
    <li>
      <Link
        href={`/entry/${show.entryId}`}
        className="group flex overflow-hidden rounded-2xl bg-surface outline-offset-2 transition hover:bg-surface-light"
      >
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-background bg-paper px-1 py-3 text-paper-ink">
          {date ? (
            <>
              {date.smallFirst && <span className="text-[11px] text-paper-muted">{date.small}</span>}
              <span className="marquee text-3xl leading-none">{date.big}</span>
              {date.middle && <span className="marquee text-lg leading-tight">{date.middle}</span>}
              {!date.smallFirst && <span className="text-[11px] text-paper-muted">{date.small}</span>}
            </>
          ) : (
            <span className="marquee text-2xl">?</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="marquee truncate text-2xl leading-tight group-hover:text-brand">{show.artist ?? t('common.unknownArtist')}</p>
            {upcoming && show.date && <span className="shrink-0 pt-1 text-xs font-medium text-brand">{ago(show.date)}</span>}
          </div>
          {(place || show.isSupport) && (
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted">
              {show.isSupport && <span className="shrink-0 rounded-full border border-border px-2 text-[11px]">{t('ticket.support')}</span>}
              <span className="truncate">{place}</span>
            </p>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="flex shrink-0 -space-x-2">
              {show.people.slice(0, 3).map((p) => (
                <span key={p.username} className="rounded-full ring-2 ring-surface">
                  <Avatar username={p.username} src={p.avatarUrl} size={24} />
                </span>
              ))}
            </span>
            <span className="truncate text-sm font-medium text-foreground">{names}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
