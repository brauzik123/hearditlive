import { describe, expect, it } from 'vitest';
import { isUpcoming, localToday, sortUpcoming } from './upcoming';

describe('localToday', () => {
  it('pads month and day', () => {
    expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isUpcoming', () => {
  const today = '2026-10-30';

  it('keeps plans from today on, and plans with no date', () => {
    expect(isUpcoming({ entry_type: 'planned', event_date: today }, today)).toBe(true);
    expect(isUpcoming({ entry_type: 'planned', event_date: '2027-01-01' }, today)).toBe(true);
    expect(isUpcoming({ entry_type: 'planned', event_date: null }, today)).toBe(true);
  });

  it('leaves out plans whose date passed, and shows you went to', () => {
    expect(isUpcoming({ entry_type: 'planned', event_date: '2026-10-29' }, today)).toBe(false);
    expect(isUpcoming({ entry_type: 'attended', event_date: '2027-01-01' }, today)).toBe(false);
  });
});

describe('sortUpcoming', () => {
  it('puts the soonest first and undated plans last', () => {
    const sorted = sortUpcoming([{ event_date: null }, { event_date: '2027-02-01' }, { event_date: '2026-11-01' }]);
    expect(sorted.map((e) => e.event_date)).toEqual(['2026-11-01', '2027-02-01', null]);
  });
});
