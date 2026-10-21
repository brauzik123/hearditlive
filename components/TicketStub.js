'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n/client';
import { formatRating } from './StarRating';
import { cityName } from '../utils/placeNames';

// The app's signature object: one logged show as a paper ticket stub.
// Main part carries the artist and venue; the torn-off stub carries the
// date (or ticket status for upcoming shows) and the rating.
//
// `entry` needs: id, entry_type, event_date, rating, ticket_status,
// artists(name), venues(name, city, cities(name_en, name_pl)). `byline` (e.g. "alice was there") and
// `meta` (e.g. "2 days ago") are optional, pre-rendered strings. `asLink`
// is off on the entry's own page, where the ticket is the header.
export default function TicketStub({ entry, byline, meta, size = 'md', asLink = true }) {
  const { t, stub, locale } = useI18n();
  const artist = entry.artists?.name ?? t('common.unknownArtist');
  const venue = [entry.venues?.name, cityName(entry.venues, locale)].filter(Boolean).join(', ');
  const planned = entry.entry_type === 'planned';
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
        {venue && <p className={`truncate text-paper-muted ${large ? 'text-base' : 'text-sm'}`}>{venue}</p>}
      </div>

      <div className="ticket-stub shrink-0 flex flex-col items-center justify-center gap-1 py-3 text-center">
        {entry.event_date ? (
          <StubDate parts={stub(entry.event_date)} />
        ) : (
          <span className="marquee text-xl">{t('ticket.dateTba')}</span>
        )}
        {planned ? (
          <span className="mt-1 px-1 text-[11px] leading-tight font-semibold">
            {t(`ticketStatus.${entry.ticket_status ?? 'interested'}`)}
          </span>
        ) : (
          entry.rating != null && (
            <span className="mt-1 flex items-center gap-0.5 text-sm font-bold" aria-label={t('ticket.rating', { stars: formatRating(entry.rating, locale) })}>
              <Star size={12} className="fill-paper-ink" /> {formatRating(entry.rating, locale)}
            </span>
          )
        )}
      </div>
    </Wrapper>
  );
}

// Date on the stub, laid out for the preferred format: "3 / Sept / 2024"
// for the spelled-out format, "03.09 / 2024" style for numeric ones.
function StubDate({ parts }) {
  const small = <span className="text-[11px] leading-none text-paper-muted">{parts.small}</span>;
  const numeric = !parts.middle;
  return (
    <>
      {parts.smallFirst && small}
      <span className={`marquee ${numeric ? 'text-2xl' : 'text-3xl'}`}>{parts.big}</span>
      {parts.middle && <span className="text-xs leading-none">{parts.middle}</span>}
      {!parts.smallFirst && small}
    </>
  );
}
