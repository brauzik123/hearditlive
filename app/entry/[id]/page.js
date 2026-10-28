import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Heart, Globe, Lock, UserCheck } from 'lucide-react';
import { createClient } from '../../../utils/supabase/server';
import { getI18n } from '../../../i18n/server';
import DeleteEntryButton from '../../../components/DeleteEntryButton';
import TicketStub from '../../../components/TicketStub';
import Avatar from '../../../components/Avatar';
import { checked } from '../../../utils/checked';

const VISIBILITY_ICON = { public: Globe, friends: UserCheck, private: Lock };
const RANK = { public: 0, friends: 1, private: 2 };

export default async function EntryDetail({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t } = await getI18n();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entry } = checked(
    await supabase
    .from('concert_entries')
    .select(
      `*, artists(name), venues(name, city, city_id, cities(name_en, name_pl)), festivals(name),
       entry_photos(id, url, caption, position),
       entry_setlist(song_name, position, is_encore, is_cover, cover_original_artist),
       entry_attendees(guest_name),
       entry_tags(tags(name)),
       profiles!concert_entries_user_id_fkey(username, avatar_url, default_entry_visibility, profile_visibility)`
    )
    .eq('id', id)
    .maybeSingle()
  );

  if (!entry) notFound();

  const isOwner = user?.id === entry.user_id;
  const ownerName = entry.profiles?.username;

  // Mirrors entry_visible_to_viewer: the profile setting is a ceiling the
  // entry's own setting can only narrow.
  const entryVisibility =
    entry.visibility === 'inherit' ? entry.profiles?.default_entry_visibility ?? 'public' : entry.visibility;
  const profileVisibility = entry.profiles?.profile_visibility ?? 'public';
  const effectiveVisibility =
    (RANK[profileVisibility] ?? 0) > (RANK[entryVisibility] ?? 0) ? profileVisibility : entryVisibility;
  const VisibilityIcon = VISIBILITY_ICON[effectiveVisibility] ?? Globe;

  const photos = (entry.entry_photos ?? []).sort((a, b) => a.position - b.position);
  const { data: signed } = photos.length
    ? await supabase.storage.from('entry-photos').createSignedUrls(photos.map((p) => p.url), 3600)
    : { data: [] };
  const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const gallery = photos.map((p) => ({ ...p, src: signedByPath.get(p.url) })).filter((p) => p.src);

  const setlist = (entry.entry_setlist ?? []).sort((a, b) => a.position - b.position);
  const mainSet = setlist.filter((s) => !s.is_encore);
  const encore = setlist.filter((s) => s.is_encore);
  const attendees = (entry.entry_attendees ?? []).map((a) => a.guest_name).filter(Boolean);
  const tags = (entry.entry_tags ?? []).map((tag) => tag.tags?.name).filter(Boolean);

  const backHref = isOwner ? '/collection' : `/u/${ownerName}`;
  const backLabel = isOwner ? t('entry.backToCollection') : t('entry.backToProfile', { name: ownerName });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> {backLabel}
        </Link>
        {isOwner && (
          <div className="flex items-start gap-2">
            <DeleteEntryButton entryId={id} userId={entry.user_id} />
            <Link
              href={`/log?edit=${id}`}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-brand"
            >
              <Pencil size={14} /> {t('common.edit')}
            </Link>
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <TicketStub entry={entry} size="lg" asLink={false} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          {entry.festivals?.name && (
            <Link
              href={`/festival/${entry.festival_id}${isOwner ? '' : `?u=${ownerName}`}`}
              className="text-brand underline-offset-4 hover:underline"
            >
              {t('entry.atFestival', { name: entry.festivals.name })}
            </Link>
          )}
          {entry.tour_name && <span>{entry.tour_name}</span>}
          {entry.is_favorite && (
            <span className="flex items-center gap-1 text-brand">
              <Heart size={13} className="fill-brand" /> {t('entry.favorite')}
            </span>
          )}
          {isOwner && (
            <span className="ml-auto flex items-center gap-1.5">
              <VisibilityIcon size={13} /> {t(`entry.visibility.${effectiveVisibility}`)}
            </span>
          )}
          {!isOwner && ownerName && (
            <Link href={`/u/${ownerName}`} className="flex items-center gap-2 hover:text-foreground">
              <Avatar username={ownerName} src={entry.profiles?.avatar_url} size={22} /> {t('entry.loggedBy', { name: ownerName })}
            </Link>
          )}
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className={`grid gap-2 ${gallery.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {gallery.map((photo, i) => (
              <figure
                key={photo.id}
                className={`overflow-hidden rounded-xl bg-surface ${gallery.length > 2 && i === 0 ? 'col-span-2' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.caption ?? ''} className="max-h-[28rem] w-full object-cover" />
                {photo.caption && <figcaption className="px-3 py-2 text-xs text-muted">{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {entry.description && (
        <section className="flex flex-col gap-2">
          <h2 className="marquee text-3xl">{t('entry.notes')}</h2>
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-foreground/90">{entry.description}</p>
        </section>
      )}

      {setlist.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="marquee text-3xl">
              {t('entry.setlist')} <span className="text-muted">{setlist.length}</span>
            </h2>
            {/* Required by setlist.fm's API terms wherever their data is shown. */}
            {entry.setlistfm_id && (
              <a
                href={entry.setlistfm_url ?? 'https://www.setlist.fm/'}
                target="_blank"
                rel="noopener"
                className="shrink-0 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('entry.setlistVia')}
              </a>
            )}
          </div>
          <ol className="flex flex-col">
            {mainSet.map((song, i) => (
              <SetlistRow key={`m-${i}`} number={i + 1} song={song} t={t} />
            ))}
          </ol>
          {encore.length > 0 && (
            <>
              <p className="mt-2 border-t border-dashed border-border pt-3 text-sm font-semibold text-brand">
                {t('entry.encore')}
              </p>
              <ol className="flex flex-col">
                {encore.map((song, i) => (
                  <SetlistRow key={`e-${i}`} number={mainSet.length + i + 1} song={song} t={t} />
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {attendees.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('entry.whoWasThere')}</h2>
          <div className="flex flex-wrap gap-3">
            {attendees.map((name) => (
              <span key={name} className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm">
                <Avatar username={name} size={26} /> {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface px-3 py-1 text-sm text-muted">
              #{tag}
            </span>
          ))}
        </section>
      )}
    </main>
  );
}

function SetlistRow({ number, song, t }) {
  return (
    <li className="flex items-baseline gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="marquee w-6 shrink-0 text-right text-lg text-muted">{number}</span>
      <span className="flex-1">
        {song.song_name}
        {song.is_cover && (
          <span className="ml-2 text-xs text-muted">
            {song.cover_original_artist ? t('entry.coverOf', { artist: song.cover_original_artist }) : t('entry.cover')}
          </span>
        )}
      </span>
    </li>
  );
}
