import { describe, expect, it } from 'vitest';
import { togetherCounts } from './together';

const ola = { user_id: 'ola', profiles: { username: 'ola', avatar_url: null } };
const show = (id, fields, attendees) => ({ id, festival_id: null, event_date: null, venue_id: null, ...fields, entry_attendees: attendees });

describe('togetherCounts', () => {
  it('counts a festival edition once, however many sets you saw together', () => {
    const entries = [
      show('a', { festival_id: 'opener', event_date: '2026-07-01' }, [ola]),
      show('b', { festival_id: 'opener', event_date: '2026-07-02' }, [ola]),
      // You split up for this set: not tagged, and it doesn't matter.
      show('c', { festival_id: 'opener', event_date: '2026-07-02' }, []),
    ];
    expect(togetherCounts(entries)).toEqual([{ name: 'ola', userId: 'ola', avatar: null, events: 1, shows: 2 }]);
  });

  it('counts the support act and the headliner on one night as one event', () => {
    const night = { event_date: '2026-03-10', venue_id: 'torwar' };
    expect(togetherCounts([show('a', night, [ola]), show('b', night, [ola])])[0]).toMatchObject({ events: 1, shows: 2 });
  });

  it('keeps friends by account and others by name, ranked by events', () => {
    const entries = [
      show('a', { event_date: '2026-01-01', venue_id: 'x' }, [ola, { guest_name: 'Kuba' }]),
      show('b', { event_date: '2026-02-01', venue_id: 'y' }, [ola, { guest_name: 'kuba ' }]),
      show('c', { event_date: '2026-03-01', venue_id: 'z' }, [ola]),
    ];
    expect(togetherCounts(entries).map((p) => [p.name, p.userId, p.events])).toEqual([
      ['ola', 'ola', 3],
      ['Kuba', null, 2],
    ]);
  });

  it('ignores empty names', () => {
    expect(togetherCounts([show('a', {}, [{ guest_name: '  ' }])])).toEqual([]);
  });
});
