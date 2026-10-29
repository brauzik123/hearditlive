'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n/client';
import { formatRating } from '../utils/rating';
import { cityName } from '../utils/placeNames';
import { billedName } from '../utils/showArtists';

// The app's signature object: one logged show as a paper ticket stub.
// Main part carries the artist and venue. The torn-off stub has the rating
// (or the ticket status for upcoming shows) on top and the date below.
//
// `entry` needs: id, entry_type, event_date, rating, ticket_status, is_support,
// artists(name), entry_co_artists(...) (see utils/showArtists.js), venues(name, city, cities(name_en, name_pl)). `byline` (e.g. "alice was there") and
// `meta` (e.g. "2 days ago") are optional, pre-rendered strings. `asLink`
// is off on the entry's own page, where the ticket is the header.
export default function TicketStub({ entry, byline, meta, size = 'md', asLink = true }) {
  const { t, date, locale } = useI18n();
  const artist = billedName(entry) ?? t('common.unknownArtist');
  const venue = [entry.venues?.name, cityName(entry.venues, locale)].filter(Boolean).join(', ');
  const planned = entry.entry_type === 'planned';
  const rated = !planned && entry.rating != null;
  const large = size === 'lg';
  const Wrapper = asLink ? Link : 'div';

  return (
    <Wrapper
      {...(asLink ? { href: `/entry/${entry.id}` } : {})}
      className={`ticket flex items-stretch ${asLink ? 'transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5' : ''}`}
    >
      <div className={`flex-1 min-w-0 flex flex-col justify-center gap-1 ${large ? 'px-6 py-6' : 'px-4 py-3.5'}`}>
        {(byline || meta) && (
          <p className="flex items-baseline justify-between gap-3 text-xs text-paper-muted">
            {byline && <span className="truncate">{byline}</span>}
            {meta && <span className="shrink-0">{meta}</span>}
          </p>
        )}
        <h3 className={`marquee ${large ? 'text-5xl md:text-6xl [overflow-wrap:anywhere]' : 'truncate text-[1.75rem]'}`}>{artist}</h3>
        {(venue || entry.is_support) && (
          <p className={`flex min-w-0 items-center gap-2 text-paper-muted ${large ? 'text-base' : 'text-sm'}`}>
            {entry.is_support && (
              <span className="shrink-0 rounded-full border border-paper-rule px-2 py-px text-[11px] font-semibold text-paper-ink">
                {t('ticket.support')}
              </span>
            )}
            {venue && <span className="truncate">{venue}</span>}
          </p>
        )}
      </div>

      {/* The stub: rating on top (a dash when unrated, the ticket status for an
          upcoming show), the date always small underneath. */}
      <div className="ticket-stub shrink-0 flex flex-col items-center justify-center gap-1.5 py-3 text-center">
        {planned ? (
          <span className="px-1 text-xs font-semibold leading-tight">{t(`ticketStatus.${entry.ticket_status ?? 'interested'}`)}</span>
        ) : rated ? (
          <span className="flex items-center gap-1" aria-label={t('ticket.rating', { stars: formatRating(entry.rating, locale) })}>
            <Star size={14} className="fill-paper-ink" aria-hidden="true" />
            <span className="marquee text-4xl leading-none">{formatRating(entry.rating, locale)}</span>
          </span>
        ) : (
          <span className="marquee text-4xl leading-none text-paper-rule" aria-label={t('log.noRating')}>
            –
          </span>
        )}
        <span className="px-1 text-[11px] leading-tight text-paper-muted">
          {entry.event_date ? date(entry.event_date) : t('ticket.dateTba')}
        </span>
      </div>
    </Wrapper>
  );
}
