import { describe, expect, it } from 'vitest';
import { attendeeNamesOf, festivalCompanions, groupGuestNames, hasAnyAttendee } from './attendees';

const friend = (username, id = username) => ({ user_id: id, guest_name: null, profiles: { username } });
const guest = (name) => ({ user_id: null, guest_name: name, profiles: null });

describe('attendeeNamesOf', () => {
  it('lists friends and typed names once each, alphabetically', () => {
    const entries = [{ entry_attendees: [friend('zosia'), guest('Ola')] }, { entry_attendees: [guest('ola ')] }, {}];
    expect(attendeeNamesOf(entries)).toEqual(['Ola', 'zosia']);
  });
});

describe('hasAnyAttendee', () => {
  const entry = { entry_attendees: [friend('zosia'), guest('Ola')] };

  it('keeps everything when nobody is chosen', () => {
    expect(hasAnyAttendee({}, [])).toBe(true);
  });

  it('matches a chosen person regardless of case', () => {
    expect(hasAnyAttendee(entry, ['ola'])).toBe(true);
    expect(hasAnyAttendee(entry, ['Kuba', 'ZOSIA'])).toBe(true);
    expect(hasAnyAttendee(entry, ['Kuba'])).toBe(false);
  });
});

describe('groupGuestNames', () => {
  it('counts typed names case-insensitively, most-used first', () => {
    const rows = [guest('Ola'), guest('ola'), guest('Kuba'), guest('Ania')];
    expect(groupGuestNames(rows)).toEqual([
      { name: 'Ola', count: 2 },
      { name: 'Ania', count: 1 },
      { name: 'Kuba', count: 1 },
    ]);
  });

  it('skips people who already have an account, and blanks', () => {
    expect(groupGuestNames([friend('zosia'), guest('  ')])).toEqual([]);
  });
});

describe('festivalCompanions', () => {
  const shows = [
    { event_date: '2026-07-02', festivals: { name: 'Open’er' }, entry_attendees: [friend('zosia', 'z1'), guest('Ola')] },
    { event_date: '2026-07-03', festivals: { name: 'open’er ' }, entry_attendees: [friend('zosia', 'z1'), guest('Kuba')] },
    { event_date: '2025-07-03', festivals: { name: 'Open’er' }, entry_attendees: [guest('Ex')] },
    { event_date: '2026-08-01', festivals: { name: 'OFF' }, entry_attendees: [guest('Other')] },
  ];

  it('gathers the people from the same festival and year, once each', () => {
    expect(festivalCompanions(shows, 'Open’er', '2026-07-04')).toEqual([
      { name: 'zosia', userId: 'z1' },
      { name: 'Ola', userId: null },
      { name: 'Kuba', userId: null },
    ]);
  });

  it('uses every edition when the new show has no date yet', () => {
    expect(festivalCompanions(shows, 'open’er', '').map((p) => p.name)).toContain('Ex');
  });

  it('finds nobody without a festival name or for an unknown festival', () => {
    expect(festivalCompanions(shows, '  ', '2026-07-04')).toEqual([]);
    expect(festivalCompanions(shows, 'Nope', '2026-07-04')).toEqual([]);
  });
});
