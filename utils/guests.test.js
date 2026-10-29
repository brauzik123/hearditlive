import { describe, expect, it } from 'vitest';
import { guestAppearances } from './guests';

const zabson = { guest_artist_id: 'z', guest: { name: 'Żabson' } };
const quebo = { guest_artist_id: 'q', guest: { name: 'Quebonafide' } };

describe('guestAppearances', () => {
  it('counts shows joined and songs played as a guest', () => {
    const rows = [
      { entry_id: 'tezzus', ...zabson },
      { entry_id: 'tezzus', ...zabson },
      { entry_id: 'other', ...zabson },
      { entry_id: 'other', ...quebo },
      { entry_id: 'other', guest_artist_id: null, guest: null },
    ];
    expect(guestAppearances(rows)).toEqual([
      { name: 'Żabson', shows: 2, songs: 3 },
      { name: 'Quebonafide', shows: 1, songs: 1 },
    ]);
  });

  it('is empty without guests', () => {
    expect(guestAppearances([{ entry_id: 'a', guest_artist_id: null }])).toEqual([]);
  });
});
