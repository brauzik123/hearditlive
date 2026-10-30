import { describe, expect, it } from 'vitest';
import { refreshPlan } from './catalogRefresh';

const NOW = new Date('2026-10-30T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('refreshPlan', () => {
  it('syncs an artist that was never synced', () => {
    expect(refreshPlan({ catalog_synced_at: null }, NOW)).toBe('full');
  });

  it('leaves a catalog alone for 30 days', () => {
    expect(refreshPlan({ catalog_synced_at: daysAgo(10), releases_total: 40 }, NOW)).toBe('skip');
  });

  it('only checks the release count between 30 and 90 days', () => {
    expect(refreshPlan({ catalog_synced_at: daysAgo(45), releases_total: 40 }, NOW)).toBe('light');
  });

  it('skips again for 30 days after a check found nothing new', () => {
    expect(refreshPlan({ catalog_synced_at: daysAgo(60), releases_total: 40, catalog_checked_at: daysAgo(15) }, NOW)).toBe('skip');
    expect(refreshPlan({ catalog_synced_at: daysAgo(80), releases_total: 40, catalog_checked_at: daysAgo(35) }, NOW)).toBe('light');
  });

  it('does a full sync after 90 days, or without a count to compare', () => {
    expect(refreshPlan({ catalog_synced_at: daysAgo(95), releases_total: 40, catalog_checked_at: daysAgo(1) }, NOW)).toBe('full');
    expect(refreshPlan({ catalog_synced_at: daysAgo(45), releases_total: null }, NOW)).toBe('full');
  });
});
