import { describe, expect, it } from 'vitest';
import { groupFriendShows } from './friendShows';

const entry = (id, user, date, artist, extra = {}) => ({
  id,
  event_date: date,
  artist_id: artist.toLowerCase(),
  artists: { name: artist },
  venues: { name: 'Atlas Arena' },
  profiles: { username: user, avatar_url: null },
  ...extra,
});

describe('groupFriendShows', () => {
  it('puts friends at the same concert on one row', () => {
    const rows = groupFriendShows([
      entry('1', 'qa_alice', '2026-10-21', 'Tezzus'),
      entry('2', 'ola', '2026-10-21', 'tezzus'),
      entry('3', 'qa_alice', '2026-10-11', 'Lucy Bedroque'),
    ]);
    expect(rows.map((r) => [r.date, r.artist, r.people.map((p) => p.username)])).toEqual([
      ['2026-10-21', 'Tezzus', ['qa_alice', 'ola']],
      ['2026-10-11', 'Lucy Bedroque', ['qa_alice']],
    ]);
    expect(rows[0].entryId).toBe('1');
  });

  it('keeps different artists on the same night apart', () => {
    const rows = groupFriendShows([
      entry('1', 'qa_alice', '2015-02-24', 'Katy Perry'),
      entry('2', 'qa_alice', '2015-02-24', 'Charli xcx', { is_support: true }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].isSupport).toBe(true);
  });

  it('names joint shows in full and lists each friend once', () => {
    const joint = { entry_co_artists: [{ artist_id: 'igi', position: 1, artists: { name: 'Young Igi' } }] };
    const rows = groupFriendShows([
      entry('1', 'brauzik123', '2022-06-03', 'Żabson', joint),
      entry('2', 'brauzik123', '2022-06-03', 'Żabson', joint),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].artist).toBe('Żabson & Young Igi');
    expect(rows[0].people).toHaveLength(1);
  });

  it('never merges undated shows', () => {
    expect(groupFriendShows([entry('1', 'a', null, 'X'), entry('2', 'b', null, 'X')])).toHaveLength(2);
  });
});
