import { useEffect, useState } from 'react';
import { Globe, Lock, Plus, Tag as TagIcon, Users, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { createClient } from '../../../utils/supabase/client';
import Avatar from '../../../components/Avatar';
import { ChipInput, Field, Section, Suggestions } from './fields';

export function PeopleSection({ form, update }) {
  const { t } = useI18n();
  return (
    <Section title={t('log.steps.people')}>
      <Field label={t('log.whoElse')} icon={Users}>
        <AttendeesInput form={form} update={update} />
      </Field>

      <Field label={t('log.tags')} icon={TagIcon}>
        <ChipInput
          items={form.tags}
          onAdd={(v) => update({ tags: [...form.tags, v] })}
          onRemove={(v) => update({ tags: form.tags.filter((tag) => tag !== v) })}
          placeholder={t('log.tagsPlaceholder')}
        />
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

// "Who was there": friends are suggested as you type and saved as their
// account (so it counts as a show together, and they can add it to their
// own log); anyone else is saved by name.
function AttendeesInput({ form, update }) {
  const { t } = useI18n();
  const friends = useFriends();
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

  return (
    <div className="flex flex-col gap-2">
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
