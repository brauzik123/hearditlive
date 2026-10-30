import { useEffect, useState } from 'react';
import { Globe, Lock, Plus, Tag as TagIcon, Tent, Users, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { createClient } from '../../../utils/supabase/client';
import { festivalCompanions } from '../../../utils/attendees';
import { unusedTags } from '../../../utils/tags';
import Avatar from '../../../components/Avatar';
import { ChipInput, Field, Section, Suggestions } from './fields';

export function PeopleSection({ form, update }) {
  const { t } = useI18n();
  const myTags = useMyTags();
  const suggestedTags = unusedTags(myTags, form.tags);
  return (
    <Section title={t('log.steps.people')}>
      <Field label={t('log.whoElse')} icon={Users}>
        <AttendeesInput form={form} update={update} />
      </Field>

      <Field label={t('log.tags')} icon={TagIcon}>
        <div className="flex flex-col gap-2">
          <ChipInput
            items={form.tags}
            onAdd={(v) => update({ tags: [...form.tags, v] })}
            onRemove={(v) => update({ tags: form.tags.filter((tag) => tag !== v) })}
            placeholder={t('log.tagsPlaceholder')}
          />
          {suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label={t('log.tagsYours')}>
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => update({ tags: [...form.tags, tag] })}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-foreground"
                >
                  <Plus size={11} /> {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label={t('log.whoCanSee')} icon={form.visibility === 'private' ? Lock : Globe}>
        <select className="field" value={form.visibility} onChange={(e) => update({ visibility: e.target.value })}>
          <option value="inherit">{t('log.visibilityDefault')}</option>
          <option value="public">{t('visibility.public')}</option>
          <option value="friends">{t('visibility.friends')}</option>
          <option value="private">{t('visibility.private')}</option>
        </select>
      </Field>
    </Section>
  );
}

// Your friends (mutual follows), for "who was there" suggestions.
function useFriends() {
  const [friends, setFriends] = useState([]);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rows } = await supabase.from('friendships').select('friend_id').eq('user_id', user.id);
      const ids = (rows ?? []).map((r) => r.friend_id);
      if (!ids.length) return;
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
      setFriends(data ?? []);
    })();
  }, []);
  return friends;
}

// The tags you've made so far, so a show doesn't need them typed again.
function useMyTags() {
  const [tags, setTags] = useState([]);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('tags').select('name').eq('user_id', user.id).order('name');
      setTags((data ?? []).map((tag) => tag.name));
    })();
  }, []);
  return tags;
}

// Your shows that are part of a festival, with who was at each.
function useMyFestivalShows() {
  const [shows, setShows] = useState([]);
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('concert_entries')
        .select('event_date, festivals!inner(name), entry_attendees(guest_name, user_id, profiles(username))')
        .eq('user_id', user.id)
        .limit(500);
      setShows(data ?? []);
    })();
  }, []);
  return shows;
}

// "Who was there": friends are suggested as you type and saved as their
// account (so it counts as a show together, and they can add it to their
// own log); anyone else is saved by name.
function AttendeesInput({ form, update }) {
  const { t } = useI18n();
  const friends = useFriends();
  const festivalShows = useMyFestivalShows();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const taken = new Set(form.attendees.map((a) => a.userId ?? a.name.toLowerCase()));
  const query = value.trim().toLowerCase();
  const suggestions = focused
    ? friends.filter((f) => !taken.has(f.id) && (!query || f.username.toLowerCase().includes(query))).slice(0, 5)
    : [];

  const add = (person) => {
    if (!person.name || taken.has(person.userId ?? person.name.toLowerCase())) return;
    update({ attendees: [...form.attendees, person] });
    setValue('');
  };
  // Typing a friend's exact username links them too.
  const addTyped = () => {
    const name = value.trim();
    if (!name) return;
    const friend = friends.find((f) => f.username.toLowerCase() === name.toLowerCase());
    add(friend ? { name: friend.username, userId: friend.id } : { name, userId: null });
  };
  const remove = (person) => update({ attendees: form.attendees.filter((a) => a !== person) });

  // Another set from the same festival: the same people, in one tap. Only a
  // current friend can be tagged by account; anyone else comes over by name.
  const companions = form.isFestival
    ? festivalCompanions(festivalShows, form.festivalName, form.date).filter(
        (p) => !taken.has(p.userId ?? p.name.toLowerCase()) && !taken.has(p.name.toLowerCase())
      )
    : [];
  const importCompanions = () => {
    const friendIds = new Set(friends.map((f) => f.id));
    const people = companions.map((p) => (p.userId && !friendIds.has(p.userId) ? { name: p.name, userId: null } : p));
    update({ attendees: [...form.attendees, ...people] });
  };

  return (
    <div className="flex flex-col gap-2">
      {companions.length > 0 && (
        <button
          type="button"
          onClick={importCompanions}
          className="flex items-center gap-2 rounded-lg border border-dashed border-brand/60 px-3 py-2 text-left text-sm transition hover:border-brand"
        >
          <Tent size={15} className="shrink-0 text-brand" />
          <span className="min-w-0">
            {t('log.importCompanions', { festival: form.festivalName.trim() })}{' '}
            <span className="text-muted">{companions.map((p) => p.name).join(', ')}</span>
          </span>
        </button>
      )}
      <div className="relative flex gap-2">
        <input
          className="field"
          placeholder={t('log.whoElsePlaceholder')}
          value={value}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTyped();
            }
          }}
        />
        <button
          type="button"
          onClick={addTyped}
          aria-label={t('common.add')}
          className="rounded-lg border border-border bg-surface-light px-3 transition hover:border-brand"
        >
          <Plus size={16} />
        </button>
        <Suggestions
          items={suggestions}
          onPick={(f) => add({ name: f.username, userId: f.id })}
          render={(f) => (
            <span className="flex items-center gap-2">
              <Avatar username={f.username} src={f.avatar_url} size={22} /> {f.username}
            </span>
          )}
        />
      </div>
      {form.attendees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {form.attendees.map((person) => (
            <span
              key={person.userId ?? person.name}
              className={`flex items-center gap-1.5 rounded-full border bg-surface-light py-1 pr-3 text-xs ${
                person.userId ? 'border-brand/60 pl-1' : 'border-border pl-3'
              }`}
            >
              {person.userId && (
                <Avatar username={person.name} src={friends.find((f) => f.id === person.userId)?.avatar_url} size={20} />
              )}
              {person.name}
              <button type="button" onClick={() => remove(person)} aria-label={t('common.remove')} className="text-muted hover:text-foreground">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {friends.length > 0 && <p className="text-xs text-muted">{t('log.whoElseFriendsHint')}</p>}
    </div>
  );
}
