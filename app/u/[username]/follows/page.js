import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '../../../../utils/supabase/server';
import { getI18n } from '../../../../i18n/server';
import { getProfileAccess } from '../../../../utils/profileAccess';
import { checked } from '../../../../utils/checked';
import Avatar from '../../../../components/Avatar';

const TABS = ['followers', 'following'];

// Who follows someone and who they follow (?tab=followers|following), from
// the numbers on a profile. Someone else's lists follow their profile's
// privacy setting.
export default async function FollowsPage({ params, searchParams }) {
  const { username } = await params;
  const { tab: requested } = await searchParams;
  const tab = TABS.includes(requested) ? requested : 'followers';
  const supabase = await createClient();
  const { t } = await getI18n();

  const access = await getProfileAccess(supabase, username);
  if (!access) notFound();
  const { profile, isSelf, canViewContent } = access;
  if (!isSelf && !canViewContent) redirect(`/u/${profile.username}`);

  // Accepted follows only; pending requests are on the Friends page.
  const { data: rows } = checked(
    tab === 'followers'
      ? await supabase
          .from('follows')
          .select('person:profiles!follows_follower_id_fkey(username, avatar_url)')
          .eq('followee_id', profile.id)
          .eq('status', 'accepted')
      : await supabase
          .from('follows')
          .select('person:profiles!follows_followee_id_fkey(username, avatar_url)')
          .eq('follower_id', profile.id)
          .eq('status', 'accepted')
  );
  const people = (rows ?? [])
    .map((r) => r.person)
    .filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:py-10">
      <Link
        href={isSelf ? '/profile' : `/u/${profile.username}`}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> {isSelf ? t('friends.backToProfile') : profile.username}
      </Link>

      <h1 className="marquee text-5xl">{profile.username}</h1>

      <nav className="grid grid-cols-2 rounded-full border border-border p-1" aria-label={profile.username}>
        {TABS.map((id) => (
          <Link
            key={id}
            href={`/u/${profile.username}/follows?tab=${id}`}
            aria-current={tab === id ? 'page' : undefined}
            className={`rounded-full py-1.5 text-center text-sm font-medium transition ${
              tab === id ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {t(`follows.${id}`)}
          </Link>
        ))}
      </nav>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
          {t(`follows.${tab}Empty`)}
        </p>
      ) : (
        <ul className="flex flex-col">
          {people.map((p) => (
            <li key={p.username} className="border-b border-border last:border-b-0">
              <Link href={`/u/${p.username}`} className="flex items-center gap-3 py-3 hover:text-brand">
                <Avatar username={p.username} src={p.avatar_url} size={44} />
                <span className="font-medium">{p.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
