import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Pencil, Star, MapPin, Calendar, Heart, Users, Tag as TagIcon,
  Image as ImageIcon, Globe, Lock, UserCheck, Ticket,
} from 'lucide-react';
import { createClient } from '../../../utils/supabase/server';

const visibilityMeta = {
  public: { icon: Globe, label: 'Visible to anyone' },
  friends: { icon: UserCheck, label: 'Friends only' },
  private: { icon: Lock, label: 'Only visible to you' },
};

const ticketStatusLabel = {
  interested: 'Interested',
  bought: 'Tickets bought',
  confirmed: 'Confirmed',
};

export default async function EntryDetail({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entry } = await supabase
    .from('concert_entries')
    .select(
      `*, artists(name), venues(name, city), festivals(name),
       entry_photos(id, url, caption, position),
       entry_setlist(song_name, position, is_encore),
       entry_attendees(guest_name),
       entry_tags(tags(name)),
       profiles!concert_entries_user_id_fkey(default_entry_visibility)`
    )
    .eq('id', id)
    .maybeSingle();

  if (!entry) notFound();

  const isOwner = user?.id === entry.user_id;
  const effectiveVisibility =
    entry.visibility === 'inherit' ? entry.profiles?.default_entry_visibility ?? 'public' : entry.visibility;
  const VisibilityIcon = visibilityMeta[effectiveVisibility]?.icon ?? Globe;

  const photos = (entry.entry_photos ?? []).sort((a, b) => a.position - b.position);
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: signed } = await supabase.storage.from('entry-photos').createSignedUrl(photo.url, 3600);
      return { ...photo, signedUrl: signed?.signedUrl ?? null };
    })
  );

  const setlist = (entry.entry_setlist ?? []).sort((a, b) => a.position - b.position);
  const attendees = (entry.entry_attendees ?? []).map((a) => a.guest_name).filter(Boolean);
  const tags = (entry.entry_tags ?? []).map((t) => t.tags?.name).filter(Boolean);

  const formattedDate = entry.event_date
    ? new Date(entry.event_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <Link href="/collection" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
          <ArrowLeft size={16} /> Back to collection
        </Link>
        {isOwner && (
          <Link
            href={`/log?edit=${id}`}
            className="flex items-center gap-1.5 text-sm bg-surface border border-border rounded-full px-3 py-1.5 hover:border-brand transition"
          >
            <Pencil size={14} /> Edit
          </Link>
        )}
      </div>

      {/* Cover + gallery */}
      {photosWithUrls.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 aspect-square bg-surface-light border border-border rounded-2xl flex items-center justify-center overflow-hidden">
              {photosWithUrls[0].signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photosWithUrls[0].signedUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={40} className="text-muted" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              {photosWithUrls.slice(1, 3).map((photo) => (
                <div
                  key={photo.id}
                  className="flex-1 bg-surface-light border border-border rounded-2xl flex items-center justify-center overflow-hidden"
                >
                  {photo.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.signedUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={20} className="text-muted" />
                  )}
                </div>
              ))}
            </div>
          </div>
          {photosWithUrls.some((p) => p.caption) && (
            <div className="flex flex-col gap-1 -mt-4">
              {photosWithUrls
                .filter((p) => p.caption)
                .map((p) => (
                  <p key={p.id} className="text-xs text-muted italic">
                    &ldquo;{p.caption}&rdquo;
                  </p>
                ))}
            </div>
          )}
        </>
      )}

      {/* Header */}
      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{entry.artists?.name ?? 'Unknown artist'}</h1>
            {entry.venues?.name && (
              <p className="text-muted flex items-center gap-1 mt-1">
                <MapPin size={14} /> {entry.venues.name}
                {entry.venues.city ? `, ${entry.venues.city}` : ''}
              </p>
            )}
            {formattedDate && (
              <p className="text-muted flex items-center gap-1 mt-1">
                <Calendar size={14} /> {formattedDate}
              </p>
            )}
          </div>
          {entry.rating != null && (
            <div className="flex items-center gap-1 text-brand font-bold text-lg shrink-0">
              <Star size={18} className="fill-brand" /> {entry.rating}/10
            </div>
          )}
          {entry.ticket_status && (
            <div className="flex items-center gap-1 text-brand font-bold text-sm shrink-0">
              <Ticket size={16} /> {ticketStatusLabel[entry.ticket_status]}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {entry.tour_name && (
            <span className="text-xs bg-surface-light border border-border rounded-full px-3 py-1">{entry.tour_name}</span>
          )}
          {entry.festivals?.name && (
            <span className="text-xs bg-surface-light border border-border rounded-full px-3 py-1">{entry.festivals.name}</span>
          )}
          {entry.is_favorite && (
            <span className="flex items-center gap-1 text-xs text-brand">
              <Heart size={12} className="fill-brand" /> Favorite
            </span>
          )}
          {isOwner && (
            <span className="flex items-center gap-1 text-xs text-muted ml-auto">
              <VisibilityIcon size={12} /> {visibilityMeta[effectiveVisibility]?.label}
            </span>
          )}
        </div>
      </section>

      <hr className="border-border" />

      {/* Description */}
      {entry.description && (
        <section>
          <h2 className="font-bold mb-2">Notes</h2>
          <p className="text-sm text-muted leading-relaxed">{entry.description}</p>
        </section>
      )}

      {/* Setlist */}
      {setlist.length > 0 && (
        <section>
          <h2 className="font-bold mb-3">Setlist</h2>
          <ol className="flex flex-col gap-2">
            {setlist.map((song, i) => (
              <li key={`${song.song_name}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="text-muted w-5 shrink-0">{i + 1}.</span>
                <span className={song.is_encore ? 'text-brand' : ''}>{song.song_name}</span>
                {song.is_encore && <span className="text-[10px] text-muted uppercase tracking-wide">encore</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Attendees */}
      {attendees.length > 0 && (
        <section>
          <h2 className="font-bold mb-3 flex items-center gap-1.5">
            <Users size={16} /> Who was there
          </h2>
          <div className="flex gap-3">
            {attendees.map((name) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-surface-light border border-border flex items-center justify-center text-xs">
                  {name[0]}
                </div>
                <span className="text-xs text-muted">{name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <section>
          <h2 className="font-bold mb-3 flex items-center gap-1.5">
            <TagIcon size={16} /> Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="text-xs bg-surface-light border border-border rounded-full px-3 py-1 text-muted">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
