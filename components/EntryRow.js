import Link from 'next/link';
import { MapPin, Star, Ticket, Music2 } from 'lucide-react';
import { formatDate, timeAgo } from '../utils/format';

// One concert in a list (activity feed, someone's profile). Expects an
// entry row with artists(name, image_url) and venues(name, city); when
// `username` is given it reads as activity ("alice went to…").
export default function EntryRow({ entry, username, showTimeAgo = false }) {
  const artist = entry.artists?.name ?? 'Unknown artist';
  const venue = [entry.venues?.name, entry.venues?.city].filter(Boolean).join(', ');
  const planned = entry.entry_type === 'planned';

  return (
    <Link
      href={`/entry/${entry.id}`}
      className="flex items-center gap-4 bg-surface-light rounded-xl p-3 border border-border hover:border-muted transition"
    >
      <div className="w-14 h-14 rounded-lg bg-surface border border-border flex items-center justify-center overflow-hidden shrink-0">
        {entry.artists?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.artists.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music2 size={18} className="text-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {username ? (
          <p className="text-sm truncate">
            <span className="font-bold">{username}</span>
            <span className="text-muted">{planned ? ' is going to ' : ' saw '}</span>
            <span className="font-bold">{artist}</span>
          </p>
        ) : (
          <p className="font-bold truncate">{artist}</p>
        )}
        <p className="text-xs text-muted truncate flex items-center gap-1 mt-0.5">
          {venue && (
            <>
              <MapPin size={12} className="shrink-0" /> {venue}
            </>
          )}
          {entry.event_date && <span>{venue ? ' · ' : ''}{formatDate(entry.event_date)}</span>}
        </p>
        {showTimeAgo && entry.created_at && <p className="text-[11px] text-muted mt-0.5">{timeAgo(entry.created_at)}</p>}
      </div>

      {planned ? (
        <Ticket size={16} className="text-brand shrink-0" />
      ) : (
        entry.rating != null && (
          <span className="flex items-center gap-1 text-sm text-brand font-bold shrink-0">
            <Star size={14} className="fill-brand" /> {entry.rating}
          </span>
        )
      )}
    </Link>
  );
}
